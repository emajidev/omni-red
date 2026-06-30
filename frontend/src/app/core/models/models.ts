/**
 * Domain models for OmniRed.
 * NOTE: object property names mirror the Postgres columns 1:1 (they are the
 * backend contract: `supabase.from(...).select('*')` returns these exact keys),
 * so they stay as defined in backend/supabase/01_schema.sql. Identifiers we own
 * (types, vars, functions) are in English.
 */

export type PersonStatus = 'desaparecido' | 'encontrado' | 'fallecido' | 'desconocido';

export type ReportSource =
  | 'twitter' | 'telegram' | 'web' | 'ocr_lista' | 'llamada' | 'whatsapp';

/**
 * URL del API/fuente que se consultó para obtener el registro (uniforme en
 * todos los endpoints de personas): el propio endpoint de OmniRed para la BD
 * propia, o la URL de la fuente externa (fvivemas / ayuda-api).
 */
export type FuenteApiUrl = string;

export type CenterCapacity = 'abierto' | 'al_limite' | 'cerrado';

/** Tipo de sitio en `centros_acopio`. */
export type CenterType = 'acopio' | 'refugio' | 'hospital';

export type OcrStatus =
  | 'subiendo' | 'escaneando' | 'desduplicando' | 'completado' | 'error';

/** Row of `reportes_personas`. */
export interface PersonReport {
  id: string;
  nombre: string;
  cedula: string | null;
  estado: PersonStatus;
  edad?: number | null;
  telefono_contacto?: string | null;
  ubicacion: string;
  lat: number;
  lng: number;
  fuente: ReportSource;              // canal del reporte (web/twitter/ocr…)
  fuente_api?: FuenteApiUrl;         // URL del API consultado (este backend)
  detalle?: string | null;
  reportado_por?: string | null;
  lista_origen_id?: string | null;
  veces_reportado: number;
  foto_url?: string | null;
  centro_id?: string | null;   // sitio (hospital/refugio) donde está la persona
  created_at: string; // ISO
}

/** Desglose por estado del contexto de búsqueda (lo devuelve el listado paginado). */
export interface PersonasTotals {
  personas: number;
  encontrados: number;
  desaparecidos: number;
  fallecidos: number;
  desconocidos: number;
}

/** Respuesta paginada del listado de personas (GET /api/personas). */
export interface PagedPersonas {
  data: PersonReport[];
  page: number;
  size: number;
  total: number;        // filas que matchean TODOS los filtros (incl. estado)
  totalPages: number;
  totals: PersonasTotals;
}

/** Parámetros de consulta del listado paginado de personas. */
export interface PersonasQuery {
  page?: number;
  size?: number;
  q?: string;
  estado?: PersonStatus;
  ubicacion?: string;
  centroId?: string;
  tipo?: 'hospital' | 'refugio';
}

/**
 * Persona localizada en una fuente EXTERNA (registro médico de fvivemas o el
 * agregador ayuda-api). Solo lectura: se usa como *fallback* del buscador
 * cuando no hay coincidencias en nuestra propia BD. NO se dibuja como marcador
 * en el mapa.
 */
export interface ExternalPerson {
  id: string;               // '<fuente>:<docId>'
  nombre: string;           // name + lastName
  cedula: string | null;    // idCard ('' → null)
  edad?: number | null;     // age
  estado?: PersonStatus;    // status override
  ubicacion: string;        // hospitalName / lugar
  lat: number | null;       // coordinates.lat
  lng: number | null;       // coordinates.lng
  telefono_contacto?: string | null; // contact.reporterPhone[0]
  detalle?: string | null;  // diagnosis · healthStatus / estado · texto
  fuente: 'fvivemas' | 'ayuda';      // nombre corto de la fuente
  fuente_api: FuenteApiUrl;          // URL del API consultado
  created_at: string;       // createdAt (ISO)
}

/** Row of `centros_acopio` (acopio, refugio u hospital según `tipo`). */
export interface ReliefCenter {
  id: string;
  nombre: string;
  ubicacion: string;
  lat: number;
  lng: number;
  tipo: CenterType;
  capacidad: CenterCapacity;
  insumos_solicitados: string[];
  contacto?: string | null;
  responsable?: string | null;
}

/** Row of `sismos`. */
export interface Quake {
  id: string;
  magnitud: number;
  epicentro: string;
  lat: number;
  lng: number;
  profundidad_km: number;
  fuente: string;
  ocurrido_en: string; // ISO
}

/**
 * Persona del AGREGADOR externo para pintar en el mapa (deduplicada y con
 * estado clasificado). `lat`/`lng` pueden venir nulos (people_db solo trae
 * parroquia) y el cliente las geocodifica por su ubicación.
 */
export interface ExternalMapPerson {
  nombre: string;
  estado: 'desaparecido' | 'encontrado' | 'desconocido';
  lat: number | null;
  lng: number | null;
  ubicacion: string;
}

/** Aggregated dashboard metrics (RPC obtener_metricas → these JSON keys). */
export interface Metrics {
  total_reportados: number;
  desaparecidos: number;
  localizados: number;
  criticos: number;
  centros_activos: number;
  sismos_24h: number;
}

/**
 * Totales del registro médico EXTERNO de fvivemas para los pills del dashboard.
 * Se calculan SOLO sobre los reportes de búsqueda de personas (`caseType`
 * `request`): total, desaparecidos (búsqueda activa) y localizados (resueltos).
 */
export interface FvivemasMetrics {
  total_reportados: number;
  desaparecidos: number;
  localizados: number;
}

/** Payload to create/merge a report (RPC reportar_persona). */
export interface NewReport {
  nombre: string;
  cedula: string | null;
  estado: PersonStatus;
  ubicacion: string;
  lat: number;
  lng: number;
  fuente: ReportSource;
  edad?: number | null;
  telefono_contacto?: string | null;
  detalle?: string | null;
  reportado_por?: string | null;
  foto_url?: string | null;
}

/** Result of reportar_persona: whether it merged (deduplicated). */
export interface ReportResult {
  unificado: boolean;
  reporte: PersonReport;
}

/** Payload to create a relief center (RPC crear_acopio). */
export interface NewCenter {
  nombre: string;
  ubicacion: string;
  lat: number;
  lng: number;
  contacto?: string | null;
  responsable?: string | null;
}

// ===========================================================================
// Edificios caídos (estructuras dañadas / colapsadas) — carga CSV
// ===========================================================================
export type DamageLevel = 'parcial' | 'severo' | 'colapsado';
export type BuildingStatus = 'reportado' | 'en_rescate' | 'despejado';

/** Row of `edificios_caidos`. */
export interface CollapsedBuilding {
  id: string;
  nombre: string;
  ubicacion: string;
  lat: number;
  lng: number;
  nivel_dano: DamageLevel;
  personas_atrapadas: number;
  estado: BuildingStatus;
  contacto?: string | null;
  created_at: string; // ISO
}

/** Batch item to create a site (acopio/refugio/hospital) from CSV. */
export interface NewCenterRow {
  nombre: string;
  ubicacion: string;
  lat: number;
  lng: number;
  tipo: CenterType;
  contacto?: string | null;
  responsable?: string | null;
}

/** Batch item to create a collapsed building from CSV. */
export interface NewBuildingRow {
  nombre: string;
  ubicacion: string;
  lat: number;
  lng: number;
  nivel_dano?: DamageLevel;
  personas_atrapadas?: number;
  estado?: BuildingStatus;
  contacto?: string | null;
}

/** Result of a CSV batch upload (centers / buildings). */
export interface BatchUploadResult {
  total: number;
  added: number;
  skipped: number;
}

/** A record extracted by OCR, candidate to be saved. */
export interface OcrRecord {
  nombre: string;
  cedula: string | null;
  estado: PersonStatus;
  ubicacion: string;
  edad?: number | null;
  /** true if the dedup engine flagged it as already existing. */
  isDuplicate: boolean;
  /** id of the existing report it collides with (when duplicate). */
  collidesWithId?: string;
}

/** A highlighted zone drawn on map startup. */
export interface HighlightZone {
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
}
