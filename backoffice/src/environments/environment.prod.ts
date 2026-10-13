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
    // Trámites reales (PLAN_TRAMITES_API.md §5): cada recurso se activa en su fase.
    // plantillas: /api/procedure-template real → hereda default real (fase 1).
    adopciones: 'mock',       // fase 2
    'fichas-locales': 'mock', // fase 3 (bloqueado por G-1)
    'puntos-atencion': 'mock', // fase 4 (se activa junto con fichas)
    // organismos: /api/organism real (SUPERADMIN) → hereda default real.
    // tipos-organismo: /api/organism-type real (SUPERADMIN) → hereda default real.
    // categorias: /api/category real → hereda default real.
    // destinatarios: /api/recipient real → hereda default real.
    // etiquetas: /api/tag real (PPDT-5.8) → hereda default real.
    // modalidades: /api/modality real → hereda default real.
    // eventos-de-vida: /api/life-event real → hereda default real.
    // localidades: endpoints públicos reales (/api/department, /api/location) → hereda default real.
    dashboard: 'mock',
    auditoria: 'mock',
    feedback: 'mock',
  } as Partial<Record<string, 'mock' | 'local' | 'prod'>>,
};
