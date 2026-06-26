import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/** Resumen de una sincronización con USGS. */
export interface SyncResult {
  fetched: number;
  inserted: number;
  skipped: number;
}

@Injectable()
export class SismosService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SismosService.name);

  /** Intervalo de auto-sync con USGS (ms). Por defecto 1 minuto. */
  private static readonly SYNC_INTERVAL_MS = Number(
    process.env.SISMOS_SYNC_INTERVAL_MS ?? 60_000,
  );

  private timer?: ReturnType<typeof setInterval>;
  /** Evita solapar ejecuciones si una tarda más que el intervalo. */
  private syncing = false;

  /** API pública de eventos del USGS (FDSN, GeoJSON, sin API key). */
  private static readonly USGS_URL =
    'https://earthquake.usgs.gov/fdsnws/event/1/query';

  /** Caja envolvente aproximada de Venezuela (lat/lng). */
  private static readonly VE_BBOX = {
    minlat: 0.5,
    maxlat: 12.7,
    minlng: -73.5,
    maxlng: -59.5,
  };

  constructor(private readonly db: DatabaseService) {}

  /**
   * Al arrancar la app: una ingesta inicial y luego cada minuto (configurable).
   * Se puede desactivar con SISMOS_SYNC_DISABLED=true.
   */
  onApplicationBootstrap(): void {
    if (process.env.SISMOS_SYNC_DISABLED === 'true') {
      this.logger.log('Auto-sync de sismos DESACTIVADO (SISMOS_SYNC_DISABLED).');
      return;
    }
    void this.runScheduledSync(); // ingesta inicial inmediata
    this.timer = setInterval(
      () => void this.runScheduledSync(),
      SismosService.SYNC_INTERVAL_MS,
    );
    // No mantener vivo el proceso solo por este temporizador.
    this.timer.unref?.();
    this.logger.log(
      `Auto-sync de sismos cada ${SismosService.SYNC_INTERVAL_MS / 1000}s.`,
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
      await this.syncFromUsgs();
    } catch (err) {
      // Fallo transitorio (red/IPv6/timeout): no es crítico, se reintenta en el
      // siguiente ciclo. Se registra como warn para no ensuciar con ERROR.
      this.logger.warn(
        `Auto-sync con USGS omitido (se reintenta): ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.syncing = false;
    }
  }

  /** Feed de sismos, más recientes primero. */
  findAll() {
    return this.db.query(
      `select * from public.sismos order by ocurrido_en desc`,
    );
  }

  /**
   * Trae los sismos recientes de Venezuela desde el USGS y los inserta en
   * `public.sismos` de forma idempotente (no duplica re-ejecuciones). Pensado
   * para llamarse on-demand (POST /sismos/sync) o desde un cron externo.
   */
  async syncFromUsgs(opts?: {
    days?: number;
    minMagnitude?: number;
  }): Promise<SyncResult> {
    const days = opts?.days ?? 7;
    const minMag = opts?.minMagnitude ?? 2.5;
    const start = new Date(Date.now() - days * 86_400_000).toISOString();
    const bb = SismosService.VE_BBOX;

    const url =
      `${SismosService.USGS_URL}?format=geojson` +
      `&starttime=${encodeURIComponent(start)}` +
      `&minmagnitude=${minMag}` +
      `&minlatitude=${bb.minlat}&maxlatitude=${bb.maxlat}` +
      `&minlongitude=${bb.minlng}&maxlongitude=${bb.maxlng}` +
      `&orderby=time`;

    const res = await fetch(url, {
      headers: { Accept: 'application/geojson' },
      // Corta la espera si la red/IPv6 no responde (evita ciclos colgados).
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`USGS respondió ${res.status} ${res.statusText}`);
    }
    const json: any = await res.json();
    const features: any[] = Array.isArray(json?.features) ? json.features : [];

    let inserted = 0;
    let skipped = 0;

    await this.db.withTransaction(async (client) => {
      for (const f of features) {
        const p = f?.properties ?? {};
        const coords = f?.geometry?.coordinates ?? [];
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        const depth = Number(coords[2] ?? 0);
        const mag = Number(p.mag);

        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(mag)) {
          skipped++;
          continue;
        }

        const epicentro = String(p.place ?? 'Epicentro desconocido');
        const ocurrido = new Date(Number(p.time)).toISOString();

        // Inserta solo si no existe ya el mismo evento (clave natural).
        const r = await client.query(
          `insert into public.sismos
             (magnitud, epicentro, lat, lng, profundidad_km, fuente, ocurrido_en)
           select $1, $2, $3, $4, $5, 'USGS', $6
            where not exists (
              select 1 from public.sismos s
               where s.fuente = 'USGS'
                 and s.ocurrido_en = $6
                 and s.lat = $3
                 and s.lng = $4
            )`,
          [mag, epicentro, lat, lng, Number.isFinite(depth) ? depth : 0, ocurrido],
        );
        if ((r.rowCount ?? 0) > 0) inserted++;
        else skipped++;
      }
    });

    this.logger.log(
      `USGS sync: ${features.length} traídos, ${inserted} nuevos, ${skipped} omitidos`,
    );
    return { fetched: features.length, inserted, skipped };
  }
}
