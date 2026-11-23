export const environment = {
  production: true,
  // Base de las rutas mockeadas.
  apiUrl: 'https://tramitesmisiones.api.dev.stagemnes.net.ar/api',
  apiBaseUrl: 'https://tramitesmisiones.api.dev.stagemnes.net.ar',

  // En prod los guards SIEMPRE validan (sin bypass).
  // Mapa del punto de atención (`shared/components/mapa-ubicacion`) y geocodificación de direcciones
  // (`@features/geocodificacion`). Servicios de OpenStreetMap: respetar su política de uso (atribución visible,
  // sin descargas masivas; Nominatim: una búsqueda por acción explícita, sin autocompletar). En staging/prod la CSP
  // del nginx tiene que permitir estos orígenes (`img-src` para los tiles, `connect-src` para Nominatim); sin eso
  // el mapa avisa que no cargó y quedan las coordenadas a mano. `geocodificacion: null` = sin proveedor ("Ubicar en
  // el mapa" se ve como no disponible).
  mapa: {
    tiles: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      atribucion: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    },
    geocodificacion: 'https://nominatim.openstreetmap.org/search' as string | null,
  },

  bypassAuthGuards: false,

  // ── Adaptador de fuente de datos (ver migracion_arquitectura.md §3.1) ──
  dataSource: 'prod' as 'mock' | 'local' | 'prod',
  // En prod, lo aún no expuesto por backend permanece mockeado hasta que exista el endpoint.
  // `apiBaseUrl` apunta al host de staging. Toda la cadena de trámites (etiquetas, plantillas, adopciones, fichas
  // por localidad y puntos de atención) va en real.
  // Requiere backend >= `586b670` (en staging desde el 2026-11-19; G-1: el response de la ficha trae su contenido
  // completo). Verificado en el esquema de `/api-docs`; los flujos contra ese host todavía no se ejecutaron.
  // Fichas y puntos quedan en real por decisión del dueño del producto (no volver a mock).
  // Si igual se lo corre contra un backend anterior, no rompe datos pero queda limitado: las fichas llegan sin
  // contenido, no se pueden editar y la UI lo avisa (compatibilidad temporal, ver `FichaLocal.sinContenido`).
  // Revisar en cada deploy.
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
    // fichas-locales: /api/organism-procedure-location real (G-1 resuelto en el backend >= 586b670) → hereda default real.
    // puntos-atencion: /api/attention-point real (misma fuente que fichas) → hereda default real.
    // etiquetas: /api/tag real → hereda default real.
    // organismos: /api/organism real (SUPERADMIN) → hereda default real.
    // tipos-organismo: /api/organism-type real (SUPERADMIN) → hereda default real.
    // categorias: /api/category real → hereda default real.
    // destinatarios: /api/recipient real → hereda default real.
    // modalidades: /api/modality real → hereda default real.
    // eventos-de-vida: /api/life-event real → hereda default real.
    // localidades: endpoints públicos reales (/api/department, /api/location) → hereda default real.
    // geocodificacion: Nominatim de OpenStreetMap (externo, `environment.mapa.geocodificacion`) → hereda default real.
    dashboard: 'mock',
    auditoria: 'mock',
    feedback: 'mock',
  } as Partial<Record<string, 'mock' | 'local' | 'prod'>>,
};
