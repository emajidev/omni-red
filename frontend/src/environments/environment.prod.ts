/**
 * Entorno de PRODUCCIÓN.
 *
 * `apiBaseUrl` relativo: se asume que la API se sirve tras el mismo dominio
 * (p. ej. detrás de un reverse proxy en `/api`). Cámbialo si la API vive en
 * otro host.
 */
export const environment = {
  production: true,
  apiBaseUrl: '/api'
};
