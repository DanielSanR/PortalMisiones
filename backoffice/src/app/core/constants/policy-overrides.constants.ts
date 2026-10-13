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
