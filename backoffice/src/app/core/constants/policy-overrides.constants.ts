import { UserRole } from '../enums/user-role.enum';
import { AccessRule } from '../models/access-rule.model';

/**
 * Prerrequisitos de una acción en el FRONT, además del permiso atómico que exige el backend.
 * No endurecen la política del backend: modelan lo que la pantalla necesita leer para funcionar.
 */
export interface Prerrequisito {
  /** Permisos que también hay que tener (todos). */
  permissions?: string[];
  /** Roles de los que hay que tener al menos uno. */
  roles?: UserRole[];
}

/**
 * El formulario de usuario carga el select de organismos (`GET /api/organism` → `READ_ORGANISM`) y
 * el de roles (`GET /api/role/allowed` → `hasRole` SUPERADMIN, ADMIN_BACKOFFICE o ADMIN_ORGANIZATION).
 * Sin eso el form no puede armarse, aunque el backend acepte `CREATE_USER`/`UPDATE_USER`.
 */
const FORM_USUARIO: Prerrequisito = {
  permissions: ['READ_ORGANISM'],
  roles: [UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE, UserRole.ADMIN_ORGANIZATION],
};

/**
 * Prerrequisitos por permiso. Fuente de verdad única: los aplica `canPerform`, así que nav, guard,
 * directiva y acciones de fila quedan alineados. Solo va acá un permiso cuyo ÚNICO uso en la UI
 * requiere el prerrequisito (crear usuario = abrir el form).
 */
export const PERMISSION_PREREQUISITES: Record<string, Prerrequisito> = {
  CREATE_USER: FORM_USUARIO,
};

/**
 * Editar un usuario abre el mismo form, pero `UPDATE_USER` también habilita acciones que no lo
 * necesitan (email, contraseña, activar/desactivar). Por eso el prerrequisito va solo en la ruta de
 * edición y en la acción "Editar", no en el permiso.
 */
export const EDITAR_USUARIO_ACCESS: AccessRule = {
  permissions: ['UPDATE_USER', ...(FORM_USUARIO.permissions ?? [])],
  mode: 'all',
  requireRoles: FORM_USUARIO.roles,
};

/**
 * Roles y Permisos (`/api/role`, `/api/permission`) se autorizan por ROL, no por permiso atómico.
 * Desde PPDT-5.1 (`0ea13a0`): leer = SUPERADMIN o ADMIN_BACKOFFICE; crear/editar/eliminar = solo
 * SUPERADMIN. Las usan ruta, nav, buscador de comandos, botón "Nuevo", CTA del vacío y acciones de fila.
 */
export const LEER_ROLES_PERMISOS_ACCESS: AccessRule = {
  requireRoles: [UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE],
};

export const ESCRIBIR_ROLES_PERMISOS_ACCESS: AccessRule = {
  requireRoles: [UserRole.SUPERADMIN],
};

/**
 * "Adoptar trámite" (`POST /api/organism-procedure` → `CREATE_ADOPTION`). El diálogo lista las
 * plantillas activas (`GET /api/procedure-template` → `READ_PROCEDURE`) y el select de organismo
 * (`GET /api/organism` → `READ_ORGANISM`). Decisión P-2 (PLAN_TRAMITES_API.md §8): sin `READ_ORGANISM`
 * "Adoptar" se oculta, porque el organismo del usuario no viaja en el JWT ni en `/api/auth/me` (G-2) y
 * el front no tiene qué mandar en `organismId`. Hoy, de facto, solo SUPERADMIN.
 * Va en el botón del header, el CTA del vacío y el buscador de comandos.
 */
export const ADOPTAR_ACCESS: AccessRule = {
  permissions: ['CREATE_ADOPTION', 'READ_PROCEDURE', 'READ_ORGANISM'],
  mode: 'all',
};

/**
 * "Agregar localidad" / alta de ficha por localidad (`POST /api/organism-procedure-location` →
 * `CREATE_VARIANT`). La ficha cuelga de una adopción: el form la lee (`GET /api/organism-procedure/{id}`
 * → `READ_ADOPTION`) para mostrar el trámite y sugerir el slug (P-5). Hoy: SA y AO (AGENT no crea).
 * Va en la ruta `tramites/fichas/nueva`, en el botón del detalle del trámite del organismo y en su vacío.
 */
export const CREAR_FICHA_ACCESS: AccessRule = {
  permissions: ['CREATE_VARIANT', 'READ_ADOPTION'],
  mode: 'all',
};

/** Política de publicación de fichas (D-3). Ver `PUBLICACION_POLICY`. */
export interface PoliticaPublicacion {
  /**
   * Quién aprueba la publicación. SOLO cambia textos ("la revisa y publica tu organismo" / "…la
   * Subsecretaría"): quién puede publicar lo decide siempre el permiso `PUBLISH_VARIANT`, nunca el rol.
   */
  aprobador: 'organismo' | 'provincial';
  /** Atajo "Enviar y publicar" (`submit-review` + `publish`) para quien tiene los dos permisos (P-3). */
  permitirEnviarYPublicar: boolean;
}

/**
 * D-3 configurable (PLAN_TRAMITES_API.md §4.3, decisión P-3 de §8): workflow explícito, sin atajo,
 * mientras D-3/G-5 sigan abiertas. Si producto cambia D-3, el backend reasigna `PUBLISH_VARIANT` en el
 * seed y acá solo cambian los textos. Prohibido usar `requireRoles` en el workflow.
 */
export const PUBLICACION_POLICY: PoliticaPublicacion = {
  aprobador: 'organismo',
  permitirEnviarYPublicar: false,
};
