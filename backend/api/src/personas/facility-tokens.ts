/**
 * Tokens distintivos del NOMBRE de un sitio (hospital/refugio) para emparejarlo
 * con la ubicación libre de los reportes. Los reportes no traen `centro_id`
 * normalizado, así que el filtro por sitio no puede unir por id: en su lugar se
 * empareja por coincidencia del nombre del sitio contra `v.ubicacion`.
 *
 * Espejo del criterio del frontend (frontend/src/app/core/util/facility-match.ts).
 */

/** Palabras genéricas/stopwords que NO identifican un sitio concreto. */
const GENERIC = new Set([
  'hospital', 'hospitales', 'clinica', 'centro', 'centros', 'refugio', 'refugios',
  'albergue', 'albergues', 'acopio', 'polideportivo', 'ambulatorio', 'modulo',
  'unidad', 'plaza', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'san', 'santa',
]);

/** Minúsculas, sin acentos y espacios colapsados. */
function normalize(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens distintivos del nombre de un sitio (sin genéricos ni cortos). */
export function facilityNameTokens(name: string | null | undefined): string[] {
  return normalize(name)
    .split(' ')
    .filter((t) => t.length >= 3 && !GENERIC.has(t));
}
