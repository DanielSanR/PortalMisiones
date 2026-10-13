import { AccessRule } from '../models/access-rule.model';
import { UserRole } from '../enums/user-role.enum';
import { ADOPTAR_ACCESS, ESCRIBIR_ROLES_PERMISOS_ACCESS } from './policy-overrides.constants';

/**
 * Comando del buscador del shell: una acción a la que se llega escribiendo, sin
 * navegar hasta la pantalla que la contiene.
 *
 * La visibilidad usa la MISMA `AccessRule` que la nav (`evaluateAccess`), así el
 * buscador nunca ofrece algo que el usuario no puede hacer.
 */
export interface Comando {
  /** Texto visible. Empieza con el verbo, para que se lea como una acción. */
  label: string;
  /** Ícono Phosphor sin el prefijo `ph-`. */
  icon: string;
  /**
   * Sinónimos por los que también matchea. El label suele no alcanzar: alguien
   * busca "alta" o "crear" antes que "nuevo".
   */
  keywords: string[];
  /** A dónde lleva. Los comandos sin ruta los resuelve el shell por `id`. */
  route?: string;
  /** Acciones que no son navegación (cerrar sesión, colapsar el menú). */
  id?: 'cerrar-sesion' | 'colapsar-nav';
  rule?: AccessRule;
}

/**
 * Registro de comandos. Solo entra lo que existe de verdad en la app: un comando
 * que no hace nada es peor que no ofrecerlo.
 */
export const COMANDOS: Comando[] = [
  // ── Altas ────────────────────────────────────────────────────────────────
  {
    label: 'Crear plantilla',
    icon: 'files',
    keywords: ['nueva', 'alta', 'agregar', 'plantilla', 'provincial', 'tramite'],
    route: '/dashboard/tramites/plantillas/nueva',
    rule: { permissions: ['CREATE_PROCEDURE'] },
  },
  {
    // El diálogo vive en "Trámites del organismo": `?adoptar=1` lo abre al entrar.
    label: 'Adoptar trámite',
    icon: 'file-arrow-down',
    keywords: ['adoptar', 'adopcion', 'tramite', 'organismo', 'vigencia', 'nuevo', 'alta'],
    route: '/dashboard/tramites/adopciones?adoptar=1',
    rule: ADOPTAR_ACCESS,
  },
  {
    // Bandeja de publicación: el listado abre la tab "En revisión" con `?tab=revision`. Las fichas no
    // tienen comando de alta: cuelgan de un trámite del organismo ("Agregar localidad" en su detalle).
    label: 'Revisar fichas por localidad',
    icon: 'map-pin-area',
    keywords: ['revision', 'publicar', 'ficha', 'localidad', 'bandeja', 'pendientes'],
    route: '/dashboard/tramites/fichas?tab=revision',
    rule: { permissions: ['READ_VARIANT', 'PUBLISH_VARIANT'], mode: 'all' },
  },
  {
    label: 'Crear organismo',
    icon: 'buildings',
    keywords: ['nuevo', 'alta', 'agregar', 'organismo'],
    route: '/dashboard/organismos/nuevo',
    rule: { permissions: ['CREATE_ORGANISM'] },
  },
  {
    label: 'Crear tipo de organismo',
    icon: 'path',
    keywords: ['nuevo', 'alta', 'agregar', 'tipo'],
    route: '/dashboard/tipos-organismo/nuevo',
    rule: { permissions: ['CREATE_ORGANISM_TYPE'] },
  },
  {
    label: 'Crear categoría',
    icon: 'folder-plus',
    keywords: ['nueva', 'alta', 'agregar', 'categoria'],
    route: '/dashboard/categorias/nuevo',
    rule: { permissions: ['CREATE_CATEGORY'] },
  },
  {
    label: 'Crear modalidad',
    icon: 'devices',
    keywords: ['nueva', 'alta', 'agregar', 'modalidad'],
    route: '/dashboard/modalidades/nuevo',
    rule: { permissions: ['CREATE_MODALITY'] },
  },
  {
    label: 'Crear evento de vida',
    icon: 'path',
    keywords: ['nuevo', 'alta', 'agregar', 'evento'],
    route: '/dashboard/eventos-de-vida/nuevo',
    rule: { permissions: ['CREATE_LIFE_EVENT'] },
  },
  {
    label: 'Crear etiqueta',
    icon: 'bookmark-simple',
    keywords: ['nueva', 'alta', 'agregar', 'etiqueta', 'tag'],
    route: '/dashboard/etiquetas/nuevo',
    rule: { permissions: ['CREATE_TAG'] },
  },
  {
    label: 'Crear destinatario',
    icon: 'users-three',
    keywords: ['nuevo', 'alta', 'agregar', 'destinatario'],
    route: '/dashboard/destinatarios/nuevo',
    rule: { permissions: ['CREATE_RECIPIENT'] },
  },
  {
    label: 'Crear usuario',
    icon: 'user-plus',
    keywords: ['nuevo', 'alta', 'agregar', 'usuario'],
    route: '/dashboard/usuarios/nuevo',
    rule: { permissions: ['CREATE_USER'] },
  },
  {
    label: 'Crear rol',
    icon: 'shield-plus',
    keywords: ['nuevo', 'alta', 'agregar', 'rol', 'permisos'],
    route: '/dashboard/roles/nuevo',
    // Roles y Permisos se gatean por ROL (igual que sus rutas). Crear = solo SUPERADMIN (PPDT-5.1).
    rule: ESCRIBIR_ROLES_PERMISOS_ACCESS,
  },
  {
    label: 'Crear permiso',
    icon: 'key',
    keywords: ['nuevo', 'alta', 'agregar', 'permiso'],
    route: '/dashboard/permisos/nuevo',
    rule: ESCRIBIR_ROLES_PERMISOS_ACCESS,
  },

  // ── Cuenta y shell ───────────────────────────────────────────────────────
  {
    label: 'Colapsar o expandir el menú',
    icon: 'sidebar',
    keywords: ['menu', 'nav', 'sidebar', 'ocultar', 'mostrar'],
    id: 'colapsar-nav',
  },
  {
    label: 'Cerrar sesión',
    icon: 'sign-out',
    keywords: ['salir', 'logout', 'desconectar'],
    id: 'cerrar-sesion',
  },
];
