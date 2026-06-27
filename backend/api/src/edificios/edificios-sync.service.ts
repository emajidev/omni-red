import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/** Resumen de una sincronización con la fuente externa de edificios. */
export interface EdificioSyncResult {
  fetched: number;
  upserted: number;
  skipped: number;
}

/** Fila tal cual la expone la tabla `buildings` de terremotovenezuela.com. */
interface SourceBuilding {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  zone: string | null;
  lat: number | null;
  lng: number | null;
  damage_level: string | null; // 'parcial' | 'severo' | 'total'
  status: string | null; // 'en_revision' | 'verificado'  (estado de MODERACIÓN)
  trapped_names: string[] | null;
  has_missing_persons: boolean | null;
  last_updated_at: string | null;
}

/**
 * Ingesta del mapa público de edificios dañados de **terremotovenezuela.com**.
 *
 * Esa web es una SPA (TanStack) que lee directo de su Supabase mediante la API
 * REST (PostgREST) con su clave *publishable*: el mapa hace
 *   GET /rest/v1/buildings?select=...&order=last_updated_at.desc
 * y RLS solo expone los edificios publicados. Aquí replicamos esa lectura EN EL
 * SERVIDOR y la volcamos en `public.edificios_caidos`, de forma que el endpoint
 * propio `GET /api/edificios` sirva también estos edificios.
 *
 * Upsert IDEMPOTENTE por (fuente, fuente_id): re-ejecutar no duplica y además
 * propaga los cambios (nivel de daño, estado, personas atrapadas, ubicación).
 *
 * Config por entorno: TERREMOTO_SUPABASE_URL, TERREMOTO_SUPABASE_KEY,
 * TERREMOTO_BUILDINGS_TABLE, EDIFICIOS_SYNC_INTERVAL_MS, EDIFICIOS_SYNC_DISABLED.
 */
@Injectable()
export class EdificiosSyncService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(EdificiosSyncService.name);

  /** Nombre corto de la fuente; clave natural junto a `fuente_id`. */
  private static readonly FUENTE = 'terremotovenezuela';

  private readonly baseUrl = (
    process.env.TERREMOTO_SUPABASE_URL ??
    'https://jckifxsdlnsvbztxydes.supabase.co'
  ).replace(/\/+$/, '');

  /** Clave *publishable* (anónima) de la fuente: solo da lectura vía RLS. */
  private readonly apiKey =
    process.env.TERREMOTO_SUPABASE_KEY ??
    'sb_publishable_i7iEDrCVZcSt0k3RGFrY4g_WrtZBB4w';

  private readonly table =
    process.env.TERREMOTO_BUILDINGS_TABLE ?? 'buildings';

  /** Intervalo de auto-sync (ms). Por defecto 5 minutos. */
  private static readonly SYNC_INTERVAL_MS = Number(
    process.env.EDIFICIOS_SYNC_INTERVAL_MS ?? 5 * 60_000,
  );

  /** Tamaño de página de PostgREST (límite por defecto del servidor: 1000). */
  private static readonly PAGE_SIZE = 1000;
  private static readonly MAX_PAGES = 20;

  /** Columnas que pedimos: las mismas que usa el mapa público + atrapados. */
  private static readonly SELECT =
    'id,name,address,city,zone,lat,lng,damage_level,status,' +
    'trapped_names,has_missing_persons,last_updated_at';

  private timer?: ReturnType<typeof setInterval>;
  /** Evita solapar ejecuciones si una tarda más que el intervalo. */
  private syncing = false;

  constructor(private readonly db: DatabaseService) {}

  /**
   * Al arrancar la app: una ingesta inicial y luego cada N minutos
   * (configurable). Se puede desactivar con EDIFICIOS_SYNC_DISABLED=true.
   */
  onApplicationBootstrap(): void {
    if (process.env.EDIFICIOS_SYNC_DISABLED === 'true') {
      this.logger.log(
        'Auto-sync de edificios DESACTIVADO (EDIFICIOS_SYNC_DISABLED).',
      );
      return;
    }
    void this.runScheduledSync(); // ingesta inicial inmediata
    this.timer = setInterval(
      () => void this.runScheduledSync(),
      EdificiosSyncService.SYNC_INTERVAL_MS,
    );
    // No mantener vivo el proceso solo por este temporizador.
    this.timer.unref?.();
    this.logger.log(
      `Auto-sync de edificios cada ${EdificiosSyncService.SYNC_INTERVAL_MS / 1000}s.`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Ejecuta el sync con guard anti-solapamiento y captura de errores. */
  private async runScheduledSync(): Promise<void> {
    if (this.syncing) {
      this.logger.debug('Sync previo aún en curso; se omite este ciclo.');
      return;
    }
    this.syncing = true;
    try {
      await this.syncFromTerremoto();
    } catch (err) {
      // Fallo transitorio (red/timeout/fuente caída): no es crítico, se
      // reintenta en el siguiente ciclo. Warn para no ensuciar con ERROR.
      this.logger.warn(
        `Auto-sync de edificios omitido (se reintenta): ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Trae los edificios publicados de terremotovenezuela.com y los inserta /
   * actualiza en `public.edificios_caidos` por (fuente, fuente_id). Pensado para
   * llamarse on-demand (POST /edificios/sync) o desde el temporizador interno.
   */
  async syncFromTerremoto(): Promise<EdificioSyncResult> {
    const rows = await this.fetchAll();

    let upserted = 0;
    let skipped = 0;

    await this.db.withTransaction(async (client) => {
      for (const b of rows) {
        const nombre = (b.name ?? '').trim();
        const lat = Number(b.lat);
        const lng = Number(b.lng);
        // Sin nombre o sin coordenadas válidas no sirve en el mapa.
        if (!nombre || !Number.isFinite(lat) || !Number.isFinite(lng)) {
          skipped++;
          continue;
        }

        const r = await client.query(
          `insert into public.edificios_caidos
             (nombre, ubicacion, lat, lng, nivel_dano, personas_atrapadas,
              estado, contacto, fuente, fuente_id)
           values ($1, $2, $3, $4, $5::nivel_dano, $6,
                   $7::estado_edificio, null, $8, $9)
           on conflict (fuente, fuente_id) where fuente is not null
           do update set
             nombre             = excluded.nombre,
             ubicacion          = excluded.ubicacion,
             lat                = excluded.lat,
             lng                = excluded.lng,
             nivel_dano         = excluded.nivel_dano,
             personas_atrapadas = excluded.personas_atrapadas,
             estado             = excluded.estado,
             updated_at         = now()`,
          [
            nombre,
            this.ubicacion(b),
            lat,
            lng,
            this.nivelDano(b.damage_level),
            this.personasAtrapadas(b.trapped_names),
            this.estado(b.status),
            EdificiosSyncService.FUENTE,
            b.id,
          ],
        );
        if ((r.rowCount ?? 0) > 0) upserted++;
        else skipped++;
      }
    });

    this.logger.log(
      `Sync terremotovenezuela: ${rows.length} traídos, ${upserted} upsertados, ${skipped} omitidos`,
    );
    return { fetched: rows.length, upserted, skipped };
  }

  // --- Fuente (PostgREST) ----------------------------------------------------
  /** Pagina la tabla `buildings` de la fuente hasta agotarla. */
  private async fetchAll(): Promise<SourceBuilding[]> {
    const out: SourceBuilding[] = [];
    for (let page = 0; page < EdificiosSyncService.MAX_PAGES; page++) {
      const from = page * EdificiosSyncService.PAGE_SIZE;
      const to = from + EdificiosSyncService.PAGE_SIZE - 1;

      const url =
        `${this.baseUrl}/rest/v1/${this.table}` +
        `?select=${encodeURIComponent(EdificiosSyncService.SELECT)}` +
        `&order=last_updated_at.desc`;

      const res = await fetch(url, {
        headers: {
          apikey: this.apiKey,
          Authorization: `Bearer ${this.apiKey}`,
          // Paginación por rango (PostgREST); evita límites de longitud de URL.
          Range: `${from}-${to}`,
        },
        // Corta la espera si la red/fuente no responde.
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        throw new Error(
          `Fuente respondió ${res.status} ${res.statusText} (${this.table})`,
        );
      }
      const batch = (await res.json()) as SourceBuilding[];
      if (!Array.isArray(batch) || batch.length === 0) break;
      out.push(...batch);
      if (batch.length < EdificiosSyncService.PAGE_SIZE) break;
    }
    return out;
  }

  // --- Mapeo fuente → edificios_caidos --------------------------------------
  /** `damage_level` de la fuente → enum `nivel_dano`. */
  private nivelDano(level: string | null): 'parcial' | 'severo' | 'colapsado' {
    switch ((level ?? '').toLowerCase()) {
      case 'parcial':
        return 'parcial';
      case 'total':
        return 'colapsado';
      case 'severo':
      default:
        return 'severo';
    }
  }

  /**
   * El `status` de la fuente es de MODERACIÓN ('en_revision' / 'verificado'),
   * no de rescate. Nuestro enum `estado_edificio` describe el rescate
   * (reportado / en_rescate / despejado), así que todo entra como 'reportado'.
   */
  private estado(_status: string | null): 'reportado' {
    return 'reportado';
  }

  /** La fuente da nombres de atrapados, no un conteo; contamos la lista. */
  private personasAtrapadas(names: string[] | null): number {
    return Array.isArray(names) ? names.length : 0;
  }

  /** Dirección legible: address; si falta, zona/ciudad. */
  private ubicacion(b: SourceBuilding): string {
    const address = (b.address ?? '').trim();
    if (address) return address;
    const partes = [b.zone, b.city]
      .map((s) => (s ?? '').trim())
      .filter(Boolean);
    return partes.join(', ') || 'Ubicación no indicada';
  }
}
