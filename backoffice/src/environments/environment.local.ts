/**
 * Dev server contra el backend LOCAL (Docker, rama `dev` del backend) — `npm run start:local`.
 *
 * - `apiBaseUrl: ''` → same-origin; `proxy.local.cjs` reenvía `/api` a http://localhost:8080 (así el e2e
 *   puede usar la API vía :4200 igual que contra staging).
 * - Todo lo que expone `dev` (@ 23fd8f9) va en real, incluidas fichas y puntos de atención: sirve para
 *   ejercitar la API nueva. Ojo: con el response mínimo de la ficha (G-1) la edición de fichas queda
 *   bloqueada por diseño (`contenidoCompleto = false`); alta, detalle y workflow sí funcionan.
 * - Requiere los grants de R-3 aplicados en la base local (ver PEDIDOS_BACKEND.md); si no, Etiquetas,
 *   Adopciones y Puntos de atención responden 403.
 */
export const environment = {
  production: false,
  apiUrl: '/api',
  apiBaseUrl: '',

  bypassAuthGuards: false,

  dataSource: 'local' as 'mock' | 'local' | 'prod',
  featureOverrides: {
    // Híbrido: alta real; listado, edición y acciones de cuenta en mock/ocultas hasta BO-17.
    usuarios: 'local',
    // Sin backend en ningún entorno:
    dashboard: 'mock',
    auditoria: 'mock',
    feedback: 'mock',
  } as Partial<Record<string, 'mock' | 'local' | 'prod'>>,
};
