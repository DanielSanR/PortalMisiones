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
    organismos: 'mock',
    categorias: 'mock',
    etiquetas: 'mock',
    modalidades: 'mock',
    'eventos-de-vida': 'mock',
    localidades: 'mock',
    dashboard: 'mock',
    auditoria: 'mock',
    feedback: 'mock',
  } as Partial<Record<string, 'mock' | 'local' | 'prod'>>,
};
