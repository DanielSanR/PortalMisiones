export const environment = {
  production: true,
  apiUrl: 'https://api.portalmisiones.gob.ar/api',
  // Backend real. En prod normalmente mismo host detrás de gateway; ajustar según deploy.
  apiBaseUrl: 'https://api.portalmisiones.gob.ar',

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
