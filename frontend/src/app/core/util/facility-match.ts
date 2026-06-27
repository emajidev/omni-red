/**
 * Asociación persona ↔ sitio (hospital/refugio) por COINCIDENCIA DE NOMBRE.
 *
 * Los reportes no traen `centro_id` normalizado, así que no se puede unir por
 * id. En su lugar emparejamos el NOMBRE del sitio contra la ubicación libre
 * reportada por la persona: basta con que la ubicación contenga alguno de los
 * tokens DISTINTIVOS del nombre del sitio (sin acentos/mayúsculas y descartando
 * palabras genéricas como "hospital", "refugio", artículos, etc.).
 */
import { PersonReport, ReliefCenter } from '../models/models';

/** Palabras genéricas/stopwords que NO identifican un sitio concreto. */
const GENERIC = new Set([
  'hospital', 'hospitales', 'clinica', 'centro', 'centros', 'refugio', 'refugios',
  'albergue', 'albergues', 'acopio', 'polideportivo', 'ambulatorio', 'modulo',
  'unidad', 'plaza', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'san', 'santa',
]);

/** Minúsculas, sin acentos y espacios colapsados (igual criterio que el backend). */
export function normalizeText(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos (acentos)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens distintivos del nombre de un sitio (sin genéricos ni cortos). */
export function facilityTokens(f: ReliefCenter): string[] {
  return normalizeText(f.nombre)
    .split(' ')
    .filter((t) => t.length >= 3 && !GENERIC.has(t));
}

/**
 * ¿La persona está en este sitio? Coincidencia por NOMBRE del sitio contra la
 * ubicación reportada. `tokens` se obtiene una vez con {@link facilityTokens}.
 */
export function personAtFacility(p: PersonReport, tokens: string[]): boolean {
  if (!tokens.length) return false;
  const ubic = normalizeText(p.ubicacion);
  return tokens.some((t) => ubic.includes(t));
}

/** Personas asociadas a un sitio por coincidencia de nombre. */
export function peopleAtFacility(people: PersonReport[], f: ReliefCenter): PersonReport[] {
  const tokens = facilityTokens(f);
  if (!tokens.length) return [];
  return people.filter((p) => personAtFacility(p, tokens));
}
