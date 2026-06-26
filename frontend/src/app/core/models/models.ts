/**
 * Domain models for OmniRed.
 * NOTE: object property names mirror the Postgres columns 1:1 (they are the
 * backend contract: `supabase.from(...).select('*')` returns these exact keys),
 * so they stay as defined in backend/supabase/01_schema.sql. Identifiers we own
 * (types, vars, functions) are in English.
 */

export type PersonStatus = 'desaparecido' | 'a_salvo' | 'fallecido';

export type ReportSource =
  | 'twitter' | 'telegram' | 'web' | 'ocr_lista' | 'llamada' | 'whatsapp';

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
  fuente: ReportSource;
  detalle?: string | null;
  reportado_por?: string | null;
  lista_origen_id?: string | null;
  veces_reportado: number;
  foto_url?: string | null;
  centro_id?: string | null;   // sitio (hospital/refugio) donde está la persona
  created_at: string; // ISO
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

/** Aggregated dashboard metrics (RPC obtener_metricas → these JSON keys). */
export interface Metrics {
  total_reportados: number;
  desaparecidos: number;
  localizados: number;
  criticos: number;
  centros_activos: number;
  sismos_24h: number;
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

/** A record extracted by OCR, candidate to be saved. */
export interface OcrRecord {
  nombre: string;
  cedula: string | null;
  estado: PersonStatus;
  ubicacion: string;
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
