/**
 * Entorno de DESARROLLO.
 *
 * El frontend consume la API NestJS (backend/api). Ajusta `apiBaseUrl` según
 * dónde la sirvas (por defecto, el servidor de desarrollo en el puerto 3000).
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api'
};
