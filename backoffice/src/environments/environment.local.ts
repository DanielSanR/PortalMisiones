/**
 * Dev server contra el backend LOCAL (Docker, rama `dev` del backend) — `npm run start:local`.
 *
 * - `apiBaseUrl: ''` → same-origin; `proxy.local.cjs` reenvía `/api` a http://localhost:8080 (así el e2e
 *   puede usar la API vía :4200 igual que contra staging).
 * - Todo lo que expone `dev` (@ 58d383a) va en real, incluidas fichas y puntos de atención: sirve para
 *   ejercitar la API nueva. Ojo: con el response mínimo de la ficha (G-1) la edición de fichas queda
 *   bloqueada por diseño (`contenidoCompleto = false`); alta, detalle y workflow sí funcionan.
 * - Requiere la base local migrada hasta `V2.30`: los grants de R-3 llegan con `V2.28` (+ `V2.30`: AGENT
 *   conserva solo READ/UPDATE_ADOPTION). Con una base anterior, Etiquetas, Adopciones y Puntos de atención
 *   responden 403.
 */
export const environment = {
  production: false,
  apiUrl: '/api',
  apiBaseUrl: '',

  bypassAuthGuards: false,

  dataSource: 'local' as 'mock' | 'local' | 'prod',
  featureOverrides: {
    // Usuarios: real (GET/POST /api/user y acciones de cuenta, BO-22). No se ofrecen la edición (sin endpoint)
    // ni el borrado definitivo (G-13); `GET /api/user` lista por alcance, pero sin rol, organismo ni nombre (G-13).
    usuarios: 'local',
    // Sin backend en ningún entorno:
    dashboard: 'mock',
    auditoria: 'mock',
    feedback: 'mock',
  } as Partial<Record<string, 'mock' | 'local' | 'prod'>>,
};
