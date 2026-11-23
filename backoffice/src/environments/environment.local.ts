/**
 * Dev server contra el backend LOCAL (Docker, rama `dev` del backend) — `npm run start:local`.
 *
 * - `apiBaseUrl: ''` → same-origin; `proxy.local.cjs` reenvía `/api` a http://localhost:8080 (así el e2e
 *   puede usar la API vía :4200 igual que contra staging).
 * - Todo lo que expone `dev` va en real, incluidas fichas y puntos de atención. REQUIERE el backend local en
 *   `dev` >= `586b670` (desde ahí el response de la ficha trae su contenido completo: alta, edición, detalle y
 *   workflow funcionan). Con un checkout anterior las fichas llegan sin contenido y no se pueden editar (la UI
 *   lo avisa). Esto describe el backend LOCAL; staging tiene `586b670` desde el 2026-11-19.
 * - Requiere la base local migrada hasta `V2.30`: los grants de R-3 llegan con `V2.28` (+ `V2.30`: AGENT
 *   conserva solo READ/UPDATE_ADOPTION). Con una base anterior, Etiquetas, Adopciones y Puntos de atención
 *   responden 403.
 */
export const environment = {
  production: false,
  apiUrl: '/api',
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
    // Sin backend en ningún entorno:
    // geocodificacion: Nominatim real (externo) → hereda default real.
    dashboard: 'mock',
    auditoria: 'mock',
    feedback: 'mock',
  } as Partial<Record<string, 'mock' | 'local' | 'prod'>>,
};
