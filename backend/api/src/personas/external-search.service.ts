import { Injectable, Logger } from '@nestjs/common';
import { MATCH_THRESHOLD, normalize, relevance } from './text-match';

/**
 * Persona del registro médico EXTERNO de fvivemas, ya normalizada al contrato
 * que consume el frontend. Solo lectura.
 */
export interface ExternalPerson {
  id: string;
  nombre: string;
  cedula: string | null;
  edad: number | null;
  ubicacion: string;
  lat: number | null;
  lng: number | null;
  telefono_contacto: string | null;
  detalle: string | null;
  /** Nombre corto de la fuente. Para fuentes externas coincide con la API. */
  fuente: 'fvivemas' | 'ayuda';
  /** URL del API/fuente que se consultó (uniforme en todos los endpoints). */
  fuente_api: string;
  created_at: string;
}

/**
 * Registro interno (caché) con los campos extra que NO se exponen en
 * {@link ExternalPerson} pero se necesitan para las métricas:
 * `caseType` ('patient' | 'request') y el `healthStatus` crudo.
 */
interface FvivemasRecord extends ExternalPerson {
  caseType: string;
  healthStatus: string;
}

/** Totales de fvivemas para los pills del dashboard. */
export interface FvivemasMetrics {
  total_reportados: number;
  desaparecidos: number;
  localizados: number;
}

/**
 * Fallback de búsqueda contra el registro médico EXTERNO de fvivemas
 * (https://asistencia-medica-fvivemas.web.app). Esa web no tiene API propia:
 * habla directo con Firestore. Aquí replicamos esa lectura vía la REST de
 * Firestore (lectura pública) y la mantenemos EN EL SERVIDOR para no exponer
 * la fuente ni sus credenciales en el cliente.
 *
 * La colección completa (~1.9k docs) se cachea en memoria con TTL; la búsqueda
 * (substring sobre nombre/cédula/ubicación) se resuelve en servidor.
 *
 * Config por entorno: FVIVEMAS_PROJECT_ID, FVIVEMAS_API_KEY, FVIVEMAS_COLLECTION.
 */
@Injectable()
export class ExternalSearchService {
  private readonly logger = new Logger(ExternalSearchService.name);

  private readonly projectId = process.env.FVIVEMAS_PROJECT_ID ?? '';
  private readonly apiKey = process.env.FVIVEMAS_API_KEY ?? '';
  private readonly collection = process.env.FVIVEMAS_COLLECTION ?? 'medical_cases';

  /** URL del API consultado (Firestore REST), expuesta en `fuente_api`. */
  private readonly apiUrl =
    `https://firestore.googleapis.com/v1/projects/${this.projectId}` +
    `/databases/(default)/documents/${this.collection}`;

  /** Solo traemos los campos que mostramos / contamos: reduce el payload. */
  private readonly FIELDS = [
    'name', 'lastName', 'idCard', 'age',
    'hospitalName', 'coordinates', 'healthStatus', 'diagnosis',
    'contact', 'createdAt', 'caseType',
  ];
  private readonly PAGE_SIZE = 300;
  private readonly MAX_PAGES = 12;
  private readonly CACHE_TTL_MS = 5 * 60_000;
  private readonly MAX_RESULTS = 50;
  private readonly MIN_QUERY = 2;

  private cache: FvivemasRecord[] = [];
  private cacheAt = 0;
  private inflight: Promise<FvivemasRecord[]> | null = null;

  /**
   * Busca personas de forma TOLERANTE (sin acentos/mayúsculas y por similitud,
   * no solo substring) sobre nombre / cédula / ubicación / detalle. Ordena por
   * relevancia y devuelve las mejores. Con menos de 2 caracteres devuelve [].
   * Nunca lanza: ante fallo de la fuente externa degrada a lista vacía.
   */
  async searchExternal(query: string): Promise<ExternalPerson[]> {
    const term = (query ?? '').trim();
    if (normalize(term).length < this.MIN_QUERY) return [];

    const all = await this.getAll();
    const scored: { p: ExternalPerson; score: number }[] = [];
    for (const p of all) {
      const score = relevance(term, [
        { text: p.nombre, weight: 1 },
        { text: p.cedula, weight: 0.95 },
        { text: p.ubicacion, weight: 0.7 },
        { text: p.detalle, weight: 0.5 },
      ]);
      if (score >= MATCH_THRESHOLD) scored.push({ p, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, this.MAX_RESULTS).map((s) => s.p);
  }

  /**
   * Totales para el dashboard, calculados SOLO sobre los reportes de búsqueda
   * de personas (`caseType === 'request'`); los pacientes hospitalarios
   * (`caseType === 'patient'`) NO se cuentan. Un caso se considera "encontrado"
   * cuando su `healthStatus` es "Resuelto"; el resto sigue "desaparecido".
   * Resiliente: ante fuente no configurada/indisponible devuelve ceros.
   */
  async metrics(): Promise<FvivemasMetrics> {
    const all = await this.getAll();
    const requests = all.filter((p) => p.caseType === 'request');
    const encontrados = requests.filter(
      (p) => this.norm(p.healthStatus) === 'resuelto',
    ).length;
    return {
      total_reportados: requests.length,
      desaparecidos: requests.length - encontrados,
      localizados: encontrados,
    };
  }

  // --- Caché -----------------------------------------------------------------
  private getAll(): Promise<FvivemasRecord[]> {
    if (!this.apiKey || !this.projectId) return Promise.resolve([]);

    const fresh = Date.now() - this.cacheAt < this.CACHE_TTL_MS;
    if (this.cache.length && fresh) return Promise.resolve(this.cache);
    if (this.inflight) return this.inflight;

    this.inflight = this.fetchAll()
      .then((list) => {
        this.cache = list;
        this.cacheAt = Date.now();
        this.logger.log(`Cacheados ${list.length} registros de fvivemas`);
        return list;
      })
      .catch((err) => {
        this.logger.warn(`No se pudo refrescar fvivemas: ${err?.message ?? err}`);
        return this.cache; // sirve lo cacheado (aunque esté vencido) si falla
      })
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  // --- Firestore REST --------------------------------------------------------
  private async fetchAll(): Promise<FvivemasRecord[]> {
    const out: FvivemasRecord[] = [];
    let pageToken: string | undefined;
    for (let i = 0; i < this.MAX_PAGES; i++) {
      const page = await this.fetchPage(pageToken);
      for (const doc of page.documents ?? []) {
        const person = this.mapDoc(doc);
        if (person) out.push(person);
      }
      if (!page.nextPageToken) break;
      pageToken = page.nextPageToken;
    }
    return out;
  }

  private async fetchPage(pageToken?: string): Promise<FsListResponse> {
    const base =
      `https://firestore.googleapis.com/v1/projects/${this.projectId}` +
      `/databases/(default)/documents/${this.collection}`;

    const params = new URLSearchParams();
    params.set('pageSize', String(this.PAGE_SIZE));
    params.set('key', this.apiKey);
    if (pageToken) params.set('pageToken', pageToken);
    for (const f of this.FIELDS) params.append('mask.fieldPaths', f);

    const res = await fetch(`${base}?${params.toString()}`);
    if (!res.ok) throw new Error(`Firestore HTTP ${res.status}`);
    return (await res.json()) as FsListResponse;
  }

  // --- Mapeo Firestore → FvivemasRecord --------------------------------------
  private mapDoc(doc: FsDocument): FvivemasRecord | null {
    const f = doc.fields ?? {};
    const get = (k: string) => this.scalar(f[k]);

    const nombre = [get('name'), get('lastName')]
      .map((v) => (v ?? '').toString().trim())
      .filter(Boolean)
      .join(' ');
    if (!nombre) return null; // sin nombre no es útil en el buscador

    const coords = (this.scalar(f['coordinates']) ?? {}) as { lat?: number; lng?: number };
    const contact = (this.scalar(f['contact']) ?? {}) as { reporterPhone?: unknown };
    const phones = Array.isArray(contact.reporterPhone)
      ? (contact.reporterPhone as unknown[]).map((p) => (p ?? '').toString().trim()).filter(Boolean)
      : [];

    const ageRaw = get('age');
    const edad = ageRaw === '' || ageRaw == null ? null : Number(ageRaw) || null;

    const idCard = (get('idCard') ?? '').toString().trim();
    const detalle =
      [get('diagnosis'), get('healthStatus')]
        .map((v) => (v ?? '').toString().trim())
        .filter(Boolean)
        .join(' · ') || null;

    return {
      id: `fvivemas:${doc.name.split('/').pop()}`,
      nombre,
      cedula: idCard || null,
      edad,
      ubicacion: (get('hospitalName') ?? '').toString().trim() || 'Hospital no indicado',
      lat: typeof coords.lat === 'number' ? coords.lat : null,
      lng: typeof coords.lng === 'number' ? coords.lng : null,
      telefono_contacto: phones[0] ?? null,
      detalle,
      fuente: 'fvivemas',
      fuente_api: this.apiUrl,
      created_at: (get('createdAt') ?? '').toString() || new Date(0).toISOString(),
      // Campos internos para las métricas (no forman parte de ExternalPerson).
      caseType: (get('caseType') ?? '').toString().trim(),
      healthStatus: (get('healthStatus') ?? '').toString().trim(),
    };
  }

  /** Convierte un value de Firestore REST a su escalar/objeto JS. */
  private scalar(v?: FsValue): unknown {
    if (!v) return null;
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return v.doubleValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.nullValue !== undefined) return null;
    if (v.arrayValue !== undefined) return (v.arrayValue.values ?? []).map((x) => this.scalar(x));
    if (v.mapValue !== undefined) {
      const obj: Record<string, unknown> = {};
      const fields = v.mapValue.fields ?? {};
      for (const k of Object.keys(fields)) obj[k] = this.scalar(fields[k]);
      return obj;
    }
    return null;
  }

  /** minúsculas + sin acentos, para comparar de forma robusta. */
  private norm(s: string): string {
    return (s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }
}

// --- Tipos del wire format de Firestore REST ---------------------------------
interface FsValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  arrayValue?: { values?: FsValue[] };
  mapValue?: { fields?: Record<string, FsValue> };
}
interface FsDocument {
  name: string;
  fields?: Record<string, FsValue>;
}
interface FsListResponse {
  documents?: FsDocument[];
  nextPageToken?: string;
}
