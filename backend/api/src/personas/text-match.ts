/**
 * Coincidencia de texto TOLERANTE para el buscador de personas: ignora
 * mayúsculas y acentos y puntúa por SIMILITUD (no solo substring/regex), usando
 * el coeficiente de Dice sobre trigramas de caracteres. Así "jose", "José",
 * "JOSE" y "jose" (o pequeños errores de tipeo) caen juntos y se ordenan por
 * cercanía a la consulta.
 *
 * Es la versión en aplicación del mismo criterio que en Postgres se resuelve con
 * `public.normalizar_texto` (lower+unaccent) + `pg_trgm` (`similarity`/`%`).
 */

/** minúsculas + sin acentos + espacios colapsados. */
export function normalize(s: string | null | undefined): string {
  return (s ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marcas diacríticas
    .replace(/[^a-z0-9\s]/g, ' ') // signos -> espacio
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trigramas de caracteres (con padding) de un texto ya normalizado. */
function trigrams(norm: string): Set<string> {
  const out = new Set<string>();
  if (!norm) return out;
  const padded = `  ${norm} `;
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** Coeficiente de Dice (0..1) entre dos conjuntos de trigramas. */
function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const g of a) if (b.has(g)) inter++;
  return (2 * inter) / (a.size + b.size);
}

/**
 * Similitud (0..1) de la consulta contra UN texto, ya normalizados ambos.
 * Premia coincidencias exactas / por prefijo / por substring y, si no, cae a la
 * similitud difusa por trigramas (tolera typos).
 */
function scoreText(nq: string, ntext: string): number {
  if (!nq || !ntext) return 0;
  if (ntext === nq) return 1;
  if (ntext.startsWith(nq)) return 0.95;
  if (ntext.includes(nq)) return 0.88;
  // Todos los tokens de la consulta aparecen (orden libre): "perez jose".
  const toks = nq.split(' ').filter((t) => t.length >= 2);
  if (toks.length > 1 && toks.every((t) => ntext.includes(t))) return 0.82;
  return dice(trigrams(nq), trigrams(ntext));
}

/** Campo a evaluar con su peso relativo. */
export interface WeightedField {
  text: string | null | undefined;
  weight: number;
}

/**
 * Relevancia (0..1) de la consulta contra varios campos ponderados; devuelve el
 * mejor. Pensado para nombre (peso alto), cédula, ubicación, detalle.
 */
export function relevance(query: string, fields: WeightedField[]): number {
  const nq = normalize(query);
  if (!nq) return 0;
  let best = 0;
  for (const f of fields) {
    const s = scoreText(nq, normalize(f.text)) * f.weight;
    if (s > best) best = s;
  }
  return best;
}

/** Umbral por defecto para considerar que una fila "coincide" de forma difusa. */
export const MATCH_THRESHOLD = 0.34;
