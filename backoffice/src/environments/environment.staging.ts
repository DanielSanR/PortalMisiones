/**
 * Dev server contra el backend ONLINE de staging (`npm run start:staging`), sin levantar Docker.
 *
 * - `apiBaseUrl: ''` → las llamadas salen same-origin (`/api/...`) y las reenvía `proxy.staging.cjs` a
 *   https://tramitesmisiones.api.dev.stagemnes.net.ar. Staging no acepta CORS desde localhost y responde
 *   403 a cualquier request con header `Origin`: el proxy lo quita.
 * - Staging corre el backend `dev` @ 58d383a (deploy del 16/11/2026): etiquetas, plantillas y adopciones van
 *   en real. Fichas por localidad y puntos de atención siguen en mock: el response de la ficha no trae su
 *   contenido (G-1) y editar contra el real lo borraría. Revisar este archivo en cada deploy de staging
 *   (`GET /api-docs` lista los paths).
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
    // Usuarios: real (GET/POST /api/user y acciones de cuenta, BO-22). No se ofrecen la edición (sin endpoint)
    // ni el borrado definitivo (G-13); `GET /api/user` lista por alcance, pero sin rol, organismo ni nombre (G-13).
    usuarios: 'local',
    // etiquetas, plantillas y adopciones: reales (heredan el default).
    // Bloqueados por G-1 (response mínimo de la ficha), igual que en prod:
    'fichas-locales': 'mock',
    'puntos-atencion': 'mock',
    // Sin backend en ningún entorno:
    dashboard: 'mock',
    auditoria: 'mock',
    feedback: 'mock',
  } as Partial<Record<string, 'mock' | 'local' | 'prod'>>,
};
