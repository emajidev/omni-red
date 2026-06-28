import { Injectable, Logger } from '@nestjs/common';
import { ExternalPerson, FvivemasMetrics } from './external-search.service';
import { relevance } from './text-match';

/**
 * Fuente EXTERNA "ayuda-api" (https://ayuda-api-...run.app), un agregador
 * (FastAPI sobre Firestore) que indexa varias fuentes públicas de personas del
 * terremoto.
 *
 * Tiene DOS superficies de personas que combinamos para maximizar cobertura
 * (eran ~19k cuando solo usábamos la primera):
 *  - `/api/search`   → índice `people_db` (sos_venezuela_2026 + desaparecidosvenezuela).
 *  - `/api/personas` → feed agregado de OTRAS fuentes que `/api/search` no
 *    devuelve por defecto: Venezuela Reporta, hospitalesenvenezuela.com y el
 *    feed completo de Desaparecidos Venezuela.
 *
 * No expone un endpoint de totales por estado (`/api/search-stats` solo da el
 * total por fuente, y cada búsqueda topa en 400 resultados), así que los totales
 * por estado (desaparecidos / encontrados) se obtienen con un BARRIDO de
 * términos frecuentes sobre AMBAS superficies, deduplicado y CACHEADO con TTL.
 *
 * Config por entorno: AYUDA_API_BASE.
 */
@Injectable()
export class AyudaSearchService {
  private readonly logger = new Logger(AyudaSearchService.name);

  private readonly base =
    process.env.AYUDA_API_BASE ??
    'https://ayuda-api-551342186435.us-central1.run.app';

  private readonly PER_QUERY_LIMIT = 400; // tope real del endpoint /api/search
  private readonly BATCH = 8; // consultas en paralelo por lote
  private readonly CACHE_TTL_MS = 15 * 60_000;
  private readonly MAX_RESULTS = 50; // resultados devueltos al buscador

  /**
   * Términos de alto rendimiento (nombres, apellidos y lugares frecuentes en
   * Venezuela + palabras de estado y vocales sueltas) para barrer el índice.
   * No pretende ser exhaustivo: maximiza cobertura con pocas consultas.
   */
  private readonly SWEEP_TERMS = [
    'jose', 'maria', 'luis', 'carlos', 'ana', 'jesus', 'victor', 'jose maria',
    'del carmen', 'gonzalez', 'rodriguez', 'perez', 'martinez', 'garcia',
    'hernandez', 'lopez', 'sanchez', 'ramirez', 'gomez', 'diaz', 'torres',
    'flores', 'rivas', 'blanco', 'marquez', 'silva', 'rojas', 'moreno', 'castro',
    'guaira', 'caracas', 'vargas', 'macuto', 'caraballeda', 'catia', 'maiquetia',
    'naiguata', 'la', 'de', 'del', 'san', 'el', 'los', 'hospital', 'clinica',
    'vida', 'desaparecid', 'encontrad', 'sano', 'encontrado', 'a', 'e', 'i', 'o', 'u',
  ];

  private metricsCache: FvivemasMetrics | null = null;
  private metricsCacheAt = 0;
  private metricsInflight: Promise<FvivemasMetrics> | null = null;

  // ==========================================================================
  // Búsqueda (para el buscador del frontend)
  // ==========================================================================
  /**
   * Busca en AMBAS superficies de ayuda-api (`/api/search` + `/api/personas`)
   * EN PARALELO, normaliza a {@link ExternalPerson}, ordena por relevancia a la
   * consulta (ambos orígenes en una sola escala) y recorta a {@link MAX_RESULTS}.
   * Así afloran personas que solo están en Venezuela Reporta / hospitales /
   * Desaparecidos Venezuela y antes se perdían.
   */
  async searchExternal(query: string): Promise<ExternalPerson[]> {
    const q = (query ?? '').trim();
    if (q.length < 2) return [];

    const [searchRows, personaRows] = await Promise.all([
      this.fetchSearch(q, this.MAX_RESULTS),
      this.fetchPersonas(q, this.MAX_RESULTS),
    ]);

    const mapped: ExternalPerson[] = [];
    for (const r of searchRows) {
      const p = this.mapRow(r);
      if (p) mapped.push(p);
    }
    for (const r of personaRows) {
      const p = this.mapPersona(r);
      if (p) mapped.push(p);
    }

    return mapped
      .map((p) => ({
        p,
        score: relevance(q, [
          { text: p.nombre, weight: 1 },
          { text: p.cedula, weight: 0.95 },
          { text: p.ubicacion, weight: 0.7 },
          { text: p.detalle, weight: 0.5 },
        ]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, this.MAX_RESULTS)
      .map((s) => s.p);
  }

  // ==========================================================================
  // Totales (desaparecidos / encontrados) — barrido cacheado
  // ==========================================================================
  async metrics(): Promise<FvivemasMetrics> {
    const fresh = Date.now() - this.metricsCacheAt < this.CACHE_TTL_MS;
    if (this.metricsCache && fresh) return this.metricsCache;
    if (this.metricsInflight) return this.metricsInflight;

    this.metricsInflight = this.sweep()
      .then((m) => {
        this.metricsCache = m;
        this.metricsCacheAt = Date.now();
        this.logger.log(
          `ayuda-api: ${m.total_reportados} docs (desap ${m.desaparecidos} / loc ${m.localizados})`,
        );
        return m;
      })
      .catch((err) => {
        this.logger.warn(`No se pudo barrer ayuda-api: ${err?.message ?? err}`);
        return this.metricsCache ?? { total_reportados: 0, desaparecidos: 0, localizados: 0 };
      })
      .finally(() => {
        this.metricsInflight = null;
      });
    return this.metricsInflight;
  }

  /**
   * Barre AMBAS superficies (`/api/search` + `/api/personas`) por términos
   * frecuentes, deduplica por id y cuenta por estado. Las dos viven en espacios
   * de id distintos, así que se cuentan como personas distintas.
   */
  private async sweep(): Promise<FvivemasMetrics> {
    const seen = new Map<string, string>(); // id -> status crudo
    for (let i = 0; i < this.SWEEP_TERMS.length; i += this.BATCH) {
      const batch = this.SWEEP_TERMS.slice(i, i + this.BATCH);
      const [searchPages, personaPages] = await Promise.all([
        Promise.all(batch.map((t) => this.fetchSearch(t, this.PER_QUERY_LIMIT))),
        Promise.all(batch.map((t) => this.fetchPersonas(t, this.PER_QUERY_LIMIT))),
      ]);
      for (const rows of searchPages) {
        for (const r of rows) seen.set(this.rowId(r), this.rawStatus(r));
      }
      for (const rows of personaPages) {
        for (const r of rows) {
          const id = `personas:${(r.doc_id ?? '').toString().trim() || (r.full_name ?? '')}`;
          seen.set(id, (r.estado ?? '').toString());
        }
      }
    }

    let desaparecidos = 0;
    let localizados = 0;
    for (const status of seen.values()) {
      const k = this.statusKind(status);
      if (k === 'desaparecido') desaparecidos++;
      else if (k === 'encontrado') localizados++;
    }
    return { total_reportados: seen.size, desaparecidos, localizados };
  }

  // ==========================================================================
  // HTTP + mapeo
  // ==========================================================================
  private async fetchSearch(q: string, limit: number): Promise<AyudaRow[]> {
    const url =
      `${this.base}/api/search?q=${encodeURIComponent(q)}&limit=${limit}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = (await res.json()) as { results?: AyudaRow[] };
      return data.results ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Consulta el feed `/api/personas` (Venezuela Reporta + hospitalesenvenezuela.com
   * + Desaparecidos Venezuela). Mismo contrato resiliente que {@link fetchSearch}:
   * ante cualquier fallo degrada a lista vacía.
   */
  private async fetchPersonas(q: string, limit: number): Promise<AyudaPersonaRow[]> {
    const url =
      `${this.base}/api/personas?q=${encodeURIComponent(q)}&limit=${limit}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = (await res.json()) as { results?: AyudaPersonaRow[] };
      return data.results ?? [];
    } catch {
      return [];
    }
  }

  private rowId(r: AyudaRow): string {
    return r._id || r.doc_id || `${r.full_name ?? ''}|${r.source ?? ''}`;
  }

  private rawStatus(r: AyudaRow): string {
    return (r.extra?.status ?? r.status ?? '').toString();
  }

  /** Clasifica el estado crudo en desaparecido / encontrado / otro. */
  private statusKind(status: string): 'desaparecido' | 'encontrado' | 'otro' {
    const n = this.norm(status);
    if (
      n === 'seeking_info' ||
      n.startsWith('desaparecid') ||
      n.startsWith('se busca') ||
      n.startsWith('buscad') || // estado "BUSCADO"/"BUSCADA" del feed /api/personas
      n.startsWith('extraviad')
    ) {
      return 'desaparecido';
    }
    if (
      n === 'found_alive' ||
      n === 'sano_salvo' ||
      n === 'hospitalized' ||
      n.startsWith('encontrad') ||
      n.includes('con vida') ||
      n.includes('sano') ||
      n.includes('alta')
    ) {
      return 'encontrado';
    }
    return 'otro';
  }

  private mapRow(r: AyudaRow): ExternalPerson | null {
    const nombre = (r.full_name ?? '').toString().trim();
    if (!nombre) return null;
    const e = r.extra ?? {};
    const ubicacion =
      (e.hospital_name || e.parroquia || e.municipio || '').toString().trim() ||
      (r.text ?? '').toString().trim() ||
      'Ubicación no indicada';
    const detalle =
      [r.status, r.text]
        .map((v) => (v ?? '').toString().trim())
        .filter(Boolean)
        .join(' · ') || null;

    return {
      id: `ayuda:${this.rowId(r)}`,
      nombre,
      cedula: (e.cedula_masked ?? '').toString().trim() || null,
      edad: null,
      ubicacion,
      lat: null,
      lng: null,
      telefono_contacto: null,
      detalle,
      fuente: 'ayuda',
      fuente_api: `${this.base}/api/search`,
      created_at:
        (r.ingested_at ?? e.source_date ?? '').toString() ||
        new Date(0).toISOString(),
    };
  }

  /**
   * Normaliza un registro del feed `/api/personas` (Venezuela Reporta /
   * hospitalesenvenezuela.com / Desaparecidos Venezuela) a {@link ExternalPerson}.
   * Trae cédula, edad y coordenadas; el `id` va en su propio espacio
   * (`ayuda:personas:…`) para no colisionar con `/api/search`.
   */
  private mapPersona(r: AyudaPersonaRow): ExternalPerson | null {
    const nombre = (r.full_name ?? '').toString().trim();
    if (!nombre) return null;

    const ubicacion = (r.ciudad_zona ?? '').toString().trim() || 'Ubicación no indicada';
    const detalle =
      [r.estado, r.descripcion]
        .map((v) => (v ?? '').toString().trim())
        .filter(Boolean)
        .join(' · ') || null;
    const edadNum = typeof r.edad === 'number' ? r.edad : Number(r.edad);
    const id = (r.doc_id ?? '').toString().trim() || `${nombre}|${r.source ?? ''}`;

    return {
      id: `ayuda:personas:${id}`,
      nombre,
      cedula: (r.cedula ?? '').toString().trim() || null,
      edad: Number.isFinite(edadNum) && edadNum > 0 ? edadNum : null,
      ubicacion,
      lat: typeof r.lat === 'number' ? r.lat : null,
      lng: typeof r.lng === 'number' ? r.lng : null,
      telefono_contacto: null,
      detalle,
      fuente: 'ayuda',
      fuente_api: `${this.base}/api/personas`,
      created_at: new Date(0).toISOString(), // el feed no expone fecha de ingesta
    };
  }

  /** minúsculas + sin acentos, para comparar de forma robusta. */
  private norm(s: string): string {
    return (s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim();
  }
}

// --- Forma (parcial) de un resultado de /api/search --------------------------
interface AyudaRow {
  _id?: string;
  doc_id?: string;
  full_name?: string;
  status?: string;
  text?: string;
  source?: string;
  source_type?: string;
  ingested_at?: string;
  image_urls?: string[];
  extra?: {
    status?: string;
    cedula_masked?: string;
    hospital_name?: string;
    parroquia?: string;
    municipio?: string;
    source_date?: string;
  };
}

// --- Forma (parcial) de un resultado de /api/personas ------------------------
interface AyudaPersonaRow {
  full_name?: string;
  doc_id?: string;
  cedula?: string;
  edad?: number | string;
  genero?: string;
  estado?: string; // BUSCADO | SANO_SALVO | INFO_RECIBIDA | …
  ciudad_zona?: string;
  descripcion?: string;
  foto_url?: string;
  source?: string; // "Venezuela Reporta" | "hospitalesenvenezuela.com" | "Desaparecidos Venezuela"
  ficha_url?: string;
  image_urls?: string[];
  lat?: number;
  lng?: number;
}
