/**
 * Entorno de DESARROLLO / DEMO.
 *
 * mode = 'mock'     → la app funciona 100 % con datos locales (sin backend).
 * mode = 'supabase' → consulta el backend real. Rellena url + anonKey.
 *
 * 🔐 SOLO se pone aquí la clave `anon` (pública por diseño). La seguridad la dan
 *    RLS + las RPC del backend. NUNCA poner aquí la `service_role`.
 */
export const environment = {
  production: false,

  supabase: {
    mode: 'mock' as 'mock' | 'supabase',
    url: 'https://TU-PROYECTO.supabase.co',
    anonKey: 'TU_ANON_KEY_PUBLICA',

    // Nombre del bucket de Storage para las listas escaneadas
    bucket: 'listas_sismo',

    // En modo supabase, leer del mapa la VISTA con PII enmascarada (recomendado)
    usarVistaEnmascarada: true,

    // Suscribirse a Realtime para refrescar mapa/métricas automáticamente
    realtime: true
  }
};
