/**
 * Dev server contra el backend ONLINE de staging (`npm run start:staging`), sin levantar Docker.
 *
 * - `apiBaseUrl: ''` → las llamadas salen same-origin (`/api/...`) y las reenvía `proxy.staging.cjs` a
 *   https://tramitesmisiones.api.dev.stagemnes.net.ar. Staging no acepta CORS desde localhost y responde
 *   403 a cualquier request con header `Origin`: el proxy lo quita.
 * - Staging corre una versión anterior del backend (≈ `d800be0`, julio): NO tiene `/api/tag` ni la API de
 *   trámites (`/api/procedure-template`, `/api/organism-procedure`, …) ni PPDT-5.1. Esos features van a
 *   mock acá. Revisar este archivo cada vez que se actualice staging (`GET /api-docs` lista los paths).
 */
export const environment = {
  production: false,
  // Base de las rutas mock (mockApiInterceptor): solo `/api/usuarios` sigue mockeado.
  apiUrl: '/api',
  // Same-origin: lo resuelve el proxy del dev server.
  apiBaseUrl: '',

  bypassAuthGuards: false,

  dataSource: 'local' as 'mock' | 'local' | 'prod',
  featureOverrides: {
    // Híbrido: alta real (POST /api/user); listado y edición en mock (no hay GET /api/user, BO-17).
    // Cambiar email/contraseña y borrado definitivo no se ofrecen con esta fuente.
    usuarios: 'local',
    // No desplegados en staging (mock hasta OPS-1, deploy de dev a staging; igual que en prod):
    etiquetas: 'mock',
    plantillas: 'mock',
    adopciones: 'mock',
    'fichas-locales': 'mock',
    'puntos-atencion': 'mock',
    // Sin backend en ningún entorno:
    dashboard: 'mock',
    auditoria: 'mock',
    feedback: 'mock',
  } as Partial<Record<string, 'mock' | 'local' | 'prod'>>,
};
