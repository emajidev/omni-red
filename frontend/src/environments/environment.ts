/**
 * Entorno de DESARROLLO.
 *
 * El frontend consume la API NestJS (backend/api). Ajusta `apiBaseUrl` según
 * dónde la sirvas (por defecto, el servidor de desarrollo en el puerto 3000).
 */
export const environment = {
  production: false,
  apiBaseUrl: 'https://omni-red-api-production.up.railway.app/api'
};
