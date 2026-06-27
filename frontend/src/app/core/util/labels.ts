/** Shared labels, colors and formatters for the UI (UI text stays in Spanish). */
import { BuildingStatus, CenterCapacity, DamageLevel, PersonStatus, ReportSource } from '../models/models';

/**
 * Inicio de la crisis sísmica actual. El MAPA solo dibuja sismos desde esta
 * fecha (la secuencia de Yumare del 24-jun-2026); el histórico los muestra todos.
 */
export const CRISIS_SINCE = new Date('2026-06-24T00:00:00Z');

export const STATUS_LABEL: Record<PersonStatus, string> = {
  desaparecido: 'Desaparecido',
  encontrado: 'Encontrado',
  fallecido: 'Fallecido',
  desconocido: 'Desconocido'
};

/** Tailwind classes per status (chip text/background). */
export const STATUS_CHIP: Record<PersonStatus, string> = {
  desaparecido: 'bg-alert/15 text-alert ring-1 ring-alert/40',
  encontrado: 'bg-safe/15 text-safe ring-1 ring-safe/40',
  fallecido: 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/40',
  desconocido: 'bg-slate-400/15 text-slate-400 ring-1 ring-slate-400/40'
};

export const SOURCE_LABEL: Record<ReportSource, string> = {
  twitter: 'Twitter/X',
  telegram: 'Telegram',
  web: 'Formulario Web',
  ocr_lista: 'Lista OCR',
  llamada: 'Llamada',
  whatsapp: 'WhatsApp'
};

export const CAPACITY_LABEL: Record<CenterCapacity, string> = {
  abierto: 'Abierto',
  al_limite: 'Al límite',
  cerrado: 'Cerrado'
};

export const CAPACITY_CHIP: Record<CenterCapacity, string> = {
  abierto: 'bg-safe/15 text-safe ring-1 ring-safe/40',
  al_limite: 'bg-warn/15 text-warn ring-1 ring-warn/40',
  cerrado: 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/40'
};

/** "hace 5 min", "hace 3 h", etc. */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

/** Pin color for a person status on the map. */
export function statusColor(s: PersonStatus): string {
  return s === 'encontrado' ? '#22c55e' : s === 'desaparecido' ? '#ef4444' : '#94a3b8';
}

// --- Edificios afectados (estructuras dañadas / colapsadas) ----------------
export const DAMAGE_LABEL: Record<DamageLevel, string> = {
  parcial: 'Daño parcial',
  severo: 'Daño severo',
  colapsado: 'Colapsado'
};

export const BUILDING_STATUS_LABEL: Record<BuildingStatus, string> = {
  reportado: 'Reportado',
  en_rescate: 'En rescate',
  despejado: 'Despejado'
};

/** Orden de gravedad para listar/ordenar edificios (colapsado primero). */
export const DAMAGE_RANK: Record<DamageLevel, number> = {
  colapsado: 0,
  severo: 1,
  parcial: 2
};

/** Color del marcador/etiqueta según el nivel de daño. */
export function damageColor(d: DamageLevel): string {
  return d === 'colapsado' ? '#ef4444' : d === 'severo' ? '#f97316' : '#f59e0b';
}

/** Color del estado de rescate del edificio. */
export function buildingStatusColor(s: BuildingStatus): string {
  return s === 'despejado' ? '#22c55e' : s === 'en_rescate' ? '#f59e0b' : '#3b82f6';
}
