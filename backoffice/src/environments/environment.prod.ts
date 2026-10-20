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
  // ⚠️ `apiBaseUrl` apunta al host de staging, que corre una versión anterior del backend (≈ julio) y NO
  // tiene `/api/tag` ni la API de trámites (ver `environment.staging.ts` y OPS-1 en PEDIDOS_BACKEND.md).
  // Lo que staging no tiene va a mock hasta OPS-1 (deploy de dev a staging); revisar en cada deploy.
  // ⚠️ Los MockDataSource de los features que acá van por HTTP se EXCLUYEN del build (angular.json →
  // production → fileReplacements → core/mocks/excluded-mock.datasource.ts). Si pasás un feature a 'mock',
  // quitá su reemplazo; si pasás uno a real, agregalo. `npm run check:prod-mocks` (prebuild) lo valida.
  featureOverrides: {
    // Híbrido: alta real (POST /api/user); listado y edición en mock (no hay GET /api/user, BO-17).
    // Cambiar email/contraseña y borrado definitivo no se ofrecen con esta fuente.
    usuarios: 'local',
    // Trámites (PLAN_TRAMITES_API.md §5): cada recurso se activa en su fase.
    plantillas: 'mock',       // fase 1: /api/procedure-template — mock hasta OPS-1 (deploy de dev a staging)
    adopciones: 'mock',       // fase 2
    'fichas-locales': 'mock', // fase 3 (bloqueado por G-1)
    'puntos-atencion': 'mock', // fase 4 (se activa junto con fichas)
    etiquetas: 'mock',        // /api/tag (PPDT-5.8) — mock hasta OPS-1 (deploy de dev a staging)
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
