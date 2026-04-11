export const ROUTES = {
  AUTH: {
    ROOT: 'auth',
    LOGIN: 'login',
  },
  DASHBOARD: {
    ROOT: 'dashboard',
    HOME: 'home',
  },
  TRAMITES: {
    ROOT: 'tramites',
    LIST: 'lista',
    CREATE: 'nuevo',
    EDIT: 'editar/:id',
    DETAIL: 'detalle/:id',
  },
  ORGANISMOS: {
    ROOT: 'organismos',
    LIST: 'lista',
    CREATE: 'nuevo',
    EDIT: 'editar/:id',
  },
  USUARIOS: {
    ROOT: 'usuarios',
    LIST: 'lista',
    CREATE: 'nuevo',
    EDIT: 'editar/:id',
  },
  REPORTES: {
    ROOT: 'reportes',
  },
} as const;
