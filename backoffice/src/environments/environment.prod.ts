export const environment = {
  production: true,
  // Base de las rutas mockeadas.
  apiUrl: 'https://tramitesmisiones.api.dev.stagemnes.net.ar/api',
  apiBaseUrl: 'https://tramitesmisiones.api.dev.stagemnes.net.ar',

  // En prod los guards SIEMPRE validan (sin bypass).
  bypassAuthGuards: false,

  // ── Adaptador de fuente de datos (ver migracion_arquitectura.md §3.1) ──
  dataSource: 'prod' as 'mock' | 'local' | 'prod',
  // En prod, lo aún no expuesto por backend permanece mockeado hasta que exista el endpoint.
  // `apiBaseUrl` apunta al host de staging, que corre el backend `dev` @ 58d383a (deploy del 16/11/2026):
  // etiquetas, plantillas y adopciones ya van en real. Revisar en cada deploy.
  // ⚠️ Los MockDataSource de los features que acá van por HTTP se EXCLUYEN del build (angular.json →
  // production → fileReplacements → core/mocks/excluded-mock.datasource.ts). Si pasás un feature a 'mock',
  // quitá su reemplazo; si pasás uno a real, agregalo. `npm run check:prod-mocks` (prebuild) lo valida.
  featureOverrides: {
    // Usuarios: real (GET/POST /api/user y acciones de cuenta, BO-22). No se ofrecen la edición (sin endpoint)
    // ni el borrado definitivo (G-13); `GET /api/user` lista por alcance, pero sin rol, organismo ni nombre (G-13).
    usuarios: 'local',
    // Trámites (PLAN_TRAMITES_API.md §5): cada recurso se activa en su fase.
    // plantillas: /api/procedure-template real → hereda default real.
    // adopciones: /api/organism-procedure real → hereda default real.
    'fichas-locales': 'mock', // bloqueado por G-1 (el response de la ficha no trae su contenido)
    'puntos-atencion': 'mock', // fase 4 (se activa junto con fichas)
    // etiquetas: /api/tag real → hereda default real.
    // organismos: /api/organism real (SUPERADMIN) → hereda default real.
    // tipos-organismo: /api/organism-type real (SUPERADMIN) → hereda default real.
    // categorias: /api/category real → hereda default real.
    // destinatarios: /api/recipient real → hereda default real.
    // modalidades: /api/modality real → hereda default real.
    // eventos-de-vida: /api/life-event real → hereda default real.
    // localidades: endpoints públicos reales (/api/department, /api/location) → hereda default real.
    dashboard: 'mock',
    auditoria: 'mock',
    feedback: 'mock',
  } as Partial<Record<string, 'mock' | 'local' | 'prod'>>,
};
