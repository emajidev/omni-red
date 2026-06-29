/**
 * Corrección de coordenadas de personas para el mapa.
 *
 * Muchos reportes (sobre todo los importados por OCR) venían amontonados en un
 * único punto por defecto, sin relación con su `ubicacion` real ("Hospital X",
 * "La Guaira", etc.). Eso hacía que (a) salieran en el lugar equivocado —incluso
 * en el mar—, (b) el mapa se saturara en un solo punto y (c) no reflejaran la
 * data real. Aquí re-derivamos la coordenada a partir de la ubicación:
 *   1) el hospital/refugio nombrado (coordenadas reales del centro),
 *   2) una localidad conocida por palabra clave,
 *   3) las coordenadas guardadas si son plausibles (con guardia anti-mar),
 *   4) un punto por defecto en tierra.
 * Se dispersa de forma DETERMINISTA (hash del id) para que varias personas del
 * mismo sitio no se apilen exactamente y el agrupamiento por cercanía luzca bien.
 */
import { ExternalMapPerson, PersonReport, ReliefCenter } from '../models/models';
import { facilityTokens, normalizeText } from './facility-match';

/** Localidades venezolanas frecuentes → coordenadas (fallback de geocodificación). */
const PLACE_KEYWORDS: { kw: string[]; lat: number; lng: number }[] = [
  { kw: ['catia la mar', 'maiquetia', 'macuto', 'caraballeda', 'naiguata', 'la guaira', 'guaira', 'vargas'], lat: 10.5985, lng: -66.9320 },
  { kw: ['catia'], lat: 10.5080, lng: -66.9480 },
  { kw: ['petare'], lat: 10.4760, lng: -66.8080 },
  { kw: ['chacao'], lat: 10.4970, lng: -66.8530 },
  { kw: ['baruta'], lat: 10.4350, lng: -66.8740 },
  { kw: ['el hatillo', 'hatillo'], lat: 10.4240, lng: -66.8240 },
  { kw: ['el valle'], lat: 10.4600, lng: -66.9100 },
  { kw: ['los teques'], lat: 10.3440, lng: -67.0410 },
  { kw: ['guarenas'], lat: 10.4710, lng: -66.6110 },
  { kw: ['guatire'], lat: 10.4700, lng: -66.5400 },
  { kw: ['miranda'], lat: 10.3500, lng: -66.9500 },
  { kw: ['maracay', 'aragua'], lat: 10.2470, lng: -67.5960 },
  { kw: ['valencia', 'carabobo'], lat: 10.1620, lng: -68.0080 },
  { kw: ['maracaibo', 'zulia'], lat: 10.6660, lng: -71.6120 },
  { kw: ['barquisimeto', 'lara'], lat: 10.0640, lng: -69.3350 },
  { kw: ['caracas', 'libertador', 'distrito capital'], lat: 10.4880, lng: -66.8790 },
];

const CARACAS = { lat: 10.4880, lng: -66.8790 };

/** Hash estable de un texto → 0..1 (dispersión sin depender de Math.random). */
function hash01(s: string, salt: number): number {
  let h = salt | 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return ((h >>> 0) % 100000) / 100000;
}

/** Evita que un punto de la costa central (Caracas/La Guaira) caiga en el mar. */
function clampSea(lat: number, lng: number): { lat: number; lng: number } {
  if (lng >= -67.6 && lng <= -65.8 && lat > 10.62) lat = 10.605;
  return { lat, lng };
}

/** Dispersa de forma determinista (~1.4 km) alrededor de (lat,lng). */
function spread(lat: number, lng: number, id: string): { lat: number; lng: number } {
  const R = 0.013;
  return clampSea(lat + (hash01(id, 7) - 0.5) * R, lng + (hash01(id, 99) - 0.5) * R);
}

/** ¿Coordenadas finitas dentro de la región (Venezuela + Caribe)? */
function inRegion(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= 0 && lat <= 16.5 && lng >= -75 && lng <= -57 &&
    !(lat === 0 && lng === 0)
  );
}

/** Corrige las coordenadas de las personas según su ubicación real. */
export function correctPeopleCoords(
  people: PersonReport[],
  centers: ReliefCenter[],
): PersonReport[] {
  const facilities = centers
    .map((c) => ({ lat: c.lat, lng: c.lng, tokens: facilityTokens(c) }))
    .filter((f) => f.tokens.length > 0 && inRegion(f.lat, f.lng));

  return people.map((p) => {
    const ubic = normalizeText(p.ubicacion);

    // 1) Mejor coincidencia de instalación (la que comparte más tokens).
    let best: { lat: number; lng: number } | null = null;
    let bestScore = 0;
    for (const f of facilities) {
      let score = 0;
      for (const t of f.tokens) if (ubic.includes(t)) score++;
      if (score > bestScore) { bestScore = score; best = f; }
    }
    if (best) return { ...p, ...spread(best.lat, best.lng, p.id) };

    // 2) Localidad por palabra clave.
    for (const pk of PLACE_KEYWORDS) {
      if (pk.kw.some((k) => ubic.includes(k))) return { ...p, ...spread(pk.lat, pk.lng, p.id) };
    }

    // 3) Coordenadas guardadas si son plausibles (con guardia anti-mar).
    if (inRegion(p.lat, p.lng)) return { ...p, ...clampSea(p.lat, p.lng) };

    // 4) Punto por defecto en tierra.
    return { ...p, ...spread(CARACAS.lat, CARACAS.lng, p.id) };
  });
}

/** Región más afectada por el sismo: fallback cuando la ubicación no se reconoce. */
const LA_GUAIRA = { lat: 10.5985, lng: -66.9320 };

/**
 * Asigna coordenadas a las personas del AGREGADOR externo para el mapa:
 * conserva las que ya traen lat/lng (con guardia anti-mar) y geocodifica por
 * palabra clave de la ubicación las que no; si no se reconoce, caen a La Guaira
 * (zona del sismo). Dispersa de forma determinista para que no se apilen.
 */
export function geocodeExternalPersons(persons: ExternalMapPerson[]): ExternalMapPerson[] {
  return persons.map((p, i) => {
    const seed = `${p.nombre}|${i}`;
    if (inRegion(p.lat ?? NaN, p.lng ?? NaN)) {
      const c = clampSea(p.lat as number, p.lng as number);
      return { ...p, lat: c.lat, lng: c.lng };
    }
    const ubic = normalizeText(p.ubicacion);
    for (const pk of PLACE_KEYWORDS) {
      if (pk.kw.some((k) => ubic.includes(k))) {
        const c = spread(pk.lat, pk.lng, seed);
        return { ...p, lat: c.lat, lng: c.lng };
      }
    }
    const c = spread(LA_GUAIRA.lat, LA_GUAIRA.lng, seed);
    return { ...p, lat: c.lat, lng: c.lng };
  });
}
