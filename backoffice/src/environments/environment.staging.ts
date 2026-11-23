/**
 * Dev server contra el backend ONLINE de staging (`npm run start:staging`), sin levantar Docker.
 *
 * - `apiBaseUrl: ''` → las llamadas salen same-origin (`/api/...`) y las reenvía `proxy.staging.cjs` a
 *   https://tramitesmisiones.api.dev.stagemnes.net.ar. Staging no acepta CORS desde localhost y responde
 *   403 a cualquier request con header `Origin`: el proxy lo quita.
 * - Toda la cadena de trámites va en real (etiquetas, plantillas, adopciones, fichas por localidad y puntos de
 *   atención). Requiere backend >= `586b670` (en staging desde el 2026-11-19; G-1: el response de la ficha
 *   trae su contenido completo, y `?organismProcedureId=` filtra). Verificado en el esquema de `/api-docs`;
 *   los flujos contra staging todavía no se ejecutaron. Fichas y puntos quedan en real por decisión del dueño
 *   del producto (no volver a mock).
 * - Contra un backend anterior el front no rompe datos, pero queda limitado (compatibilidad temporal, ver
 *   `FichaLocal.sinContenido`): las fichas llegan sin contenido, no se pueden editar y el detalle lo avisa.
 * - Revisar este archivo en cada deploy de staging (`GET /api-docs` lista los paths).
 */
export const environment = {
  production: false,
  // Base de las rutas mock (mockApiInterceptor): solo `/api/usuarios` sigue mockeado.
  apiUrl: '/api',
  // Same-origin: lo resuelve el proxy del dev server.
  apiBaseUrl: '',

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

  dataSource: 'local' as 'mock' | 'local' | 'prod',
  featureOverrides: {
    // Usuarios: real (GET/POST /api/user y acciones de cuenta, BO-22). No se ofrecen la edición (sin endpoint)
    // ni el borrado definitivo (G-13); `GET /api/user` lista por alcance, pero sin rol, organismo ni nombre (G-13).
    usuarios: 'local',
    // etiquetas, plantillas, adopciones, fichas-locales y puntos-atencion: reales (heredan el default).
    // Sin backend en ningún entorno:
    // geocodificacion: Nominatim real (externo). La CSP de staging lo bloquea hasta sumar su origen a `connect-src`.
    dashboard: 'mock',
    auditoria: 'mock',
    feedback: 'mock',
  } as Partial<Record<string, 'mock' | 'local' | 'prod'>>,
};
