export const environment = {
  production: false,
  // Base de las rutas mockeadas heredadas (mockApiInterceptor). Mantener hasta que el
  // backend exponga esos endpoints (trámites, organismos, etc. — ver §7 del API spec).
  apiUrl: 'http://localhost:3000/api',
  // Backend real (Spring Boot). Sin context-path: cada controller trae su propio prefijo /api/...
  apiBaseUrl: 'http://localhost:8080',

  // Bypass de los guards (auth/rol) para testear sin fricción en dev. En prod = false.
  bypassAuthGuards: true,

  // ── Adaptador de fuente de datos (ver migracion_arquitectura.md §3.1) ──
  // Default global: 'mock' | 'local' | 'prod'. 'local'/'prod' = HTTP (difieren en apiBaseUrl).
  dataSource: 'local' as 'mock' | 'local' | 'prod',
  // Override por feature. Lo bloqueado por backend (API spec §7) se mantiene en 'mock'.
  featureOverrides: {
    // Usuarios: híbrido. El datasource HTTP hace POST /api/user REAL (create) y delega
    // listado/edición al mock (el backend no expone GET /api/user ni update genérico).
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
