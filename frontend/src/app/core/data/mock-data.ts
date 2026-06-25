/**
 * Fictional test data, geographically coherent with Venezuela.
 * Mirrors backend/supabase/04_seed.sql so the demo runs with no backend.
 * North-central region: Distrito Capital, La Guaira, Miranda, Aragua, Carabobo.
 * (Object keys mirror DB columns; see models.ts note.)
 */
import { PersonReport, ReliefCenter, Quake, HighlightZone } from '../models/models';

const now = () => Date.now();
const minsAgo = (m: number) => new Date(now() - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(now() - h * 3_600_000).toISOString();

export const MOCK_PEOPLE: PersonReport[] = [
  {
    id: 'p-001', nombre: 'María Alejandra Rodríguez', cedula: 'V-12.345.678',
    estado: 'a_salvo', edad: 34, ubicacion: 'Refugio Montalbán, Caracas',
    lat: 10.4225, lng: -66.9510, fuente: 'ocr_lista', veces_reportado: 2,
    detalle: 'Reportada a salvo en refugio. Familia notificada.',
    reportado_por: 'rescate.montalban', created_at: hoursAgo(7)
  },
  {
    id: 'p-002', nombre: 'José Gregorio Pérez', cedula: 'V-15.678.901',
    estado: 'desaparecido', edad: 41, ubicacion: 'Catia, Parroquia Sucre, Caracas',
    lat: 10.5080, lng: -66.9480, fuente: 'twitter', veces_reportado: 3,
    detalle: 'No se le ve desde la primera réplica. Vestía camisa azul.',
    reportado_por: '@familiaperezccs', created_at: hoursAgo(6)
  },
  {
    id: 'p-003', nombre: 'Carmen Teresa Hernández', cedula: 'V-9.876.543',
    estado: 'desaparecido', edad: 58, ubicacion: 'Petare, Sector La Bombilla, Miranda',
    lat: 10.4760, lng: -66.8080, fuente: 'telegram', veces_reportado: 1,
    detalle: 'Adulto mayor, requiere medicación para hipertensión.',
    reportado_por: 'brigada_petare', created_at: hoursAgo(5)
  },
  {
    id: 'p-004', nombre: 'Luis Eduardo González', cedula: 'V-18.234.567',
    estado: 'a_salvo', edad: 27, ubicacion: 'La Guaira, Maiquetía',
    lat: 10.5940, lng: -66.9870, fuente: 'web', veces_reportado: 1,
    detalle: 'Reportó por formulario que está bien.',
    reportado_por: 'autorreporte', created_at: hoursAgo(4)
  },
  {
    id: 'p-005', nombre: 'Yetzabel Coromoto Marcano', cedula: 'V-20.111.222',
    estado: 'desaparecido', edad: 23, ubicacion: 'El Valle, Caracas',
    lat: 10.4500, lng: -66.9200, fuente: 'twitter', veces_reportado: 2,
    detalle: 'Estudiante UCV, sin señales desde la madrugada.',
    reportado_por: '@buscamosyetza', created_at: hoursAgo(5.5)
  },
  {
    id: 'p-006', nombre: 'Pedro Ramón Salazar', cedula: 'V-7.654.321',
    estado: 'desaparecido', edad: 63, ubicacion: 'Los Teques, Miranda',
    lat: 10.3440, lng: -67.0410, fuente: 'whatsapp', veces_reportado: 1,
    detalle: 'Salió a comprar agua y no regresó.',
    reportado_por: 'fam_salazar', created_at: hoursAgo(3)
  },
  {
    id: 'p-007', nombre: 'Andreína Valentina Suárez', cedula: 'V-25.333.444',
    estado: 'a_salvo', edad: 19, ubicacion: 'Chacao, Caracas',
    lat: 10.4970, lng: -66.8530, fuente: 'telegram', veces_reportado: 1,
    detalle: 'A salvo con vecinos, edificio evacuado.',
    reportado_por: 'consejo_comunal_chacao', created_at: hoursAgo(2.5)
  },
  {
    id: 'p-008', nombre: 'Wilmer Antonio Bracho', cedula: 'V-14.222.888',
    estado: 'desaparecido', edad: 47, ubicacion: 'Maracay, Aragua',
    lat: 10.2470, lng: -67.5960, fuente: 'web', veces_reportado: 1,
    detalle: 'Trabajaba en zona industrial al momento del sismo.',
    reportado_por: 'autorreporte', created_at: hoursAgo(2)
  },
  {
    id: 'p-009', nombre: 'Rosángela del Carmen Mora', cedula: 'V-16.789.012',
    estado: 'a_salvo', edad: 36, ubicacion: 'Valencia, Carabobo',
    lat: 10.1620, lng: -68.0080, fuente: 'ocr_lista', veces_reportado: 1,
    detalle: 'Listada como presente en albergue Naguanagua.',
    reportado_por: 'albergue_naguanagua', created_at: hoursAgo(1.5)
  },
  {
    id: 'p-010', nombre: 'Héctor Luis Ramírez', cedula: 'V-11.444.777',
    estado: 'desaparecido', edad: 52, ubicacion: 'Guarenas, Miranda',
    lat: 10.4710, lng: -66.6110, fuente: 'twitter', veces_reportado: 2,
    detalle: 'Reportado por dos vecinos distintos.',
    reportado_por: '@guarenasunida', created_at: hoursAgo(1)
  },
  {
    id: 'p-011', nombre: 'Daniela Beatriz Linares', cedula: 'V-22.555.666',
    estado: 'a_salvo', edad: 29, ubicacion: 'Baruta, Caracas',
    lat: 10.4320, lng: -66.8750, fuente: 'telegram', veces_reportado: 1,
    detalle: 'Confirmada sana y salva por su hermana.',
    reportado_por: 'fam_linares', created_at: minsAgo(50)
  },
  {
    id: 'p-012', nombre: 'Francisco Javier Ovalles', cedula: 'V-8.123.456',
    estado: 'desaparecido', edad: 60, ubicacion: 'Charallave, Valles del Tuy, Miranda',
    lat: 10.2440, lng: -66.8570, fuente: 'whatsapp', veces_reportado: 1,
    detalle: 'Sin contacto, vive solo. Urgente.',
    reportado_por: 'cruz_roja_tuy', created_at: minsAgo(35)
  },
  {
    id: 'p-013', nombre: 'Gabriela Alexandra Fermín', cedula: 'V-19.876.000',
    estado: 'a_salvo', edad: 31, ubicacion: 'La Victoria, Aragua',
    lat: 10.2270, lng: -67.3330, fuente: 'web', veces_reportado: 1,
    detalle: 'Autorreporte: a salvo en casa de familiares.',
    reportado_por: 'autorreporte', created_at: minsAgo(20)
  },
  {
    id: 'p-014', nombre: 'Ángel David Mújica', cedula: 'V-13.999.111',
    estado: 'desaparecido', edad: 38, ubicacion: 'Guatire, Miranda',
    lat: 10.4760, lng: -66.5400, fuente: 'twitter', veces_reportado: 2,
    detalle: 'Bombero voluntario, no responde radio.',
    reportado_por: '@bomberosguatire', created_at: minsAgo(12)
  }
];

export const MOCK_CENTERS: ReliefCenter[] = [
  {
    id: 'a-001', nombre: 'Acopio UCV - Plaza del Rectorado',
    ubicacion: 'Ciudad Universitaria, Caracas', lat: 10.4910, lng: -66.8900,
    capacidad: 'abierto', insumos_solicitados: ['agua', 'medicinas', 'alimentos'],
    contacto: '0212-555-1010', responsable: 'Coord. Voluntariado UCV'
  },
  {
    id: 'a-002', nombre: 'Refugio Montalbán', ubicacion: 'Montalbán, Caracas',
    lat: 10.4225, lng: -66.9510, capacidad: 'al_limite',
    insumos_solicitados: ['colchonetas', 'agua', 'pañales'],
    contacto: '0414-555-2020', responsable: 'Parroquia San Judas Tadeo'
  },
  {
    id: 'a-003', nombre: 'Polideportivo Los Teques', ubicacion: 'Los Teques, Miranda',
    lat: 10.3440, lng: -67.0410, capacidad: 'abierto',
    insumos_solicitados: ['alimentos', 'ropa', 'agua'],
    contacto: '0212-555-3030', responsable: 'Alcaldía de Guaicaipuro'
  },
  {
    id: 'a-004', nombre: 'Albergue Naguanagua', ubicacion: 'Naguanagua, Carabobo',
    lat: 10.2470, lng: -68.0150, capacidad: 'al_limite',
    insumos_solicitados: ['medicinas', 'agua'],
    contacto: '0241-555-4040', responsable: 'Protección Civil Carabobo'
  },
  {
    id: 'a-005', nombre: 'Centro Diana - La Guaira', ubicacion: 'Catia La Mar, La Guaira',
    lat: 10.5980, lng: -67.0250, capacidad: 'cerrado', insumos_solicitados: [],
    contacto: '0212-555-5050', responsable: 'Bomberos Marinos'
  },
  {
    id: 'a-006', nombre: 'Acopio Maracay - Plaza Bolívar', ubicacion: 'Maracay, Aragua',
    lat: 10.2467, lng: -67.5960, capacidad: 'abierto',
    insumos_solicitados: ['agua', 'alimentos', 'linternas', 'medicinas'],
    contacto: '0243-555-6060', responsable: 'Cruz Roja Aragua'
  }
];

export const MOCK_QUAKES: Quake[] = [
  { id: 's-001', magnitud: 6.2, epicentro: 'Costa de La Guaira', lat: 10.7200, lng: -66.9000, profundidad_km: 12.5, fuente: 'FUNVISIS', ocurrido_en: hoursAgo(6) },
  { id: 's-002', magnitud: 4.8, epicentro: 'Norte de Caracas', lat: 10.6100, lng: -66.8700, profundidad_km: 8.0, fuente: 'FUNVISIS', ocurrido_en: hoursAgo(5.2) },
  { id: 's-003', magnitud: 3.9, epicentro: 'Mar Caribe, frente a Vargas', lat: 10.8500, lng: -67.0500, profundidad_km: 15.2, fuente: 'USGS', ocurrido_en: hoursAgo(3.7) },
  { id: 's-004', magnitud: 4.1, epicentro: 'Los Teques, Miranda', lat: 10.3500, lng: -67.0500, profundidad_km: 6.5, fuente: 'FUNVISIS', ocurrido_en: hoursAgo(2.3) },
  { id: 's-005', magnitud: 3.2, epicentro: 'Valles del Tuy', lat: 10.2300, lng: -66.8800, profundidad_km: 9.1, fuente: 'FUNVISIS', ocurrido_en: hoursAgo(1.1) },
  { id: 's-006', magnitud: 2.8, epicentro: 'Maracay, Aragua', lat: 10.2600, lng: -67.6000, profundidad_km: 7.3, fuente: 'FUNVISIS', ocurrido_en: minsAgo(25) }
];

/**
 * "Extracted" OCR rows. One (María Rodríguez, V-12.345.678) intentionally
 * matches p-001 to trigger the AI deduplication alert.
 */
export const MOCK_OCR_ROWS = [
  { nombre: 'María Alejandra Rodríguez', cedula: 'V-12.345.678', estado: 'a_salvo' as const, ubicacion: 'Refugio Montalbán, Caracas' },
  { nombre: 'Jesús Manuel Aponte', cedula: 'V-21.456.789', estado: 'a_salvo' as const, ubicacion: 'Refugio Montalbán, Caracas' },
  { nombre: 'Norelys Carolina Páez', cedula: 'V-17.654.321', estado: 'a_salvo' as const, ubicacion: 'Refugio Montalbán, Caracas' }
];

/** Zones to highlight when the map first loads. */
export const HIGHLIGHT_ZONES: HighlightZone[] = [
  { name: 'Caracas',   lat: 10.4806, lng: -66.9036, radiusKm: 14 },
  { name: 'La Guaira', lat: 10.6000, lng: -66.9330, radiusKm: 10 },
  { name: 'Carabobo',  lat: 10.1700, lng: -68.0000, radiusKm: 18 }
];
