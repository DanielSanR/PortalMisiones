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
  featureOverrides: {
    usuarios: 'local',
    tramites: 'mock',
    // organismos: /api/organism real (SUPERADMIN) → hereda default real.
    // tipos-organismo: /api/organism-type real (SUPERADMIN) → hereda default real.
    // categorias: /api/category real → hereda default real.
    // destinatarios: /api/recipient real → hereda default real.
    etiquetas: 'mock',
    // modalidades: /api/modality real → hereda default real.
    // eventos-de-vida: /api/life-event real → hereda default real.
    // localidades: endpoints públicos reales (/api/department, /api/location) → hereda default real.
    dashboard: 'mock',
    auditoria: 'mock',
    feedback: 'mock',
  } as Partial<Record<string, 'mock' | 'local' | 'prod'>>,
};
