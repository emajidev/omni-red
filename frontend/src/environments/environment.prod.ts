/**
 * Entorno de PRODUCCIÓN.
 * Sustituye los valores por los del proyecto Supabase real (solo clave `anon`).
 * Idealmente inyéctalos en tiempo de build desde variables de CI, no los comitees.
 */
export const environment = {
  production: true,

  supabase: {
    mode: 'supabase' as 'mock' | 'supabase',
    url: 'https://TU-PROYECTO.supabase.co',
    anonKey: 'TU_ANON_KEY_PUBLICA',
    bucket: 'listas_sismo',
    usarVistaEnmascarada: true,
    realtime: true
  }
};
