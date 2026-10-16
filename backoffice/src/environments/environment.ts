export const environment = {
  production: false,
  // Base de las rutas mockeadas heredadas (mockApiInterceptor). Mantener hasta que el
  // backend exponga listado/edición de usuarios (único resto del mock por interceptor).
  apiUrl: 'http://localhost:3000/api',
  // Backend real (Spring Boot). Sin context-path: cada controller trae su propio prefijo /api/...
  apiBaseUrl: 'http://localhost:8080',

  // Bypass de los guards para dev sin fricción. FALSE = el accessGuard evalúa permisos igual que en
  // prod (protege las rutas por permiso y redirige a home si no tenés acceso). Poné true solo para
  // maquetar UI sin login/backend.
  bypassAuthGuards: false,

  // ── Adaptador de fuente de datos (ver migracion_arquitectura.md §3.1) ──
  // Default global: 'mock' | 'local' | 'prod'. 'local'/'prod' = HTTP (difieren en apiBaseUrl).
  dataSource: 'local' as 'mock' | 'local' | 'prod',
  // Override por feature. Lo bloqueado por backend (API spec §7) se mantiene en 'mock'.
  featureOverrides: {
    // Usuarios: híbrido. El datasource HTTP hace POST /api/user REAL (create) y delega
    // listado/edición al mock (el backend no expone GET /api/user ni update genérico, BO-17).
    // Cambiar email/contraseña y borrado definitivo no se ofrecen con esta fuente.
    usuarios: 'local',
    // Trámites (PLAN_TRAMITES_API.md): la cadena plantilla → adopción → ficha → punto de atención se referencia
    // por ids, así que va TODA con la misma fuente. Mezclarlas (p. ej. plantillas real + adopciones mock) hace que
    // el front pida al backend plantillas con ids del mock (`pt-1`) → 500. Para la cadena real contra el backend
    // local: `npm run start:local` (environment.local.ts).
    plantillas: 'mock',       // fase 1 (real en start:local)
    adopciones: 'mock',       // fase 2 (G-15: crear/editar da 500 en dev)
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
