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

/** Distancia de edición (Levenshtein) entre dos cadenas cortas. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Similitud por edición (0..1) — buena para typos en palabras CORTAS. */
function editSim(a: string, b: string): number {
  if (!a || !b) return 0;
  const max = Math.max(a.length, b.length);
  return max ? 1 - levenshtein(a, b) / max : 0;
}

/**
 * Mejor similitud por edición entre cada token de la consulta (≥3 chars) y cada
 * token del texto. Captura "joze"→"jose" o "gonzalez"→"gonzales" que los
 * trigramas, en palabras cortas, no alcanzan.
 */
function bestTokenEditSim(nq: string, ntext: string): number {
  const qToks = nq.split(' ').filter((t) => t.length >= 3);
  const tToks = ntext.split(' ').filter(Boolean);
  let best = 0;
  for (const q of qToks) {
    for (const t of tToks) {
      const s = editSim(q, t);
      if (s > best) best = s;
    }
  }
  return best;
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
  // Difuso: lo mejor entre trigramas (palabras largas) y edición por token
  // (typos en palabras cortas).
  return Math.max(dice(trigrams(nq), trigrams(ntext)), bestTokenEditSim(nq, ntext));
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
