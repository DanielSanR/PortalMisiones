import { UserRole } from '../enums/user-role.enum';

/**
 * Excepciones de política: permisos que —además del permiso atómico— exigen un rol canónico
 * específico (AND). Es una política MÁS ESTRICTA que el seed del backend (que sí da la acción a
 * otros roles). Fuente de verdad única: se declara acá y la respetan nav, guards y la directiva
 * `*appHasPermission` porque todos evalúan vía `canPerform`.
 *
 * Gestión de usuarios → SUPERADMIN: el form de alta/edición carga el select de organismos desde
 * `/api/organism` (permiso `READ_ORGANISM`, que en el seed solo tiene SUPERADMIN — §4.2). Aunque el
 * backend habilite `CREATE/UPDATE/DELETE_USER` a ADMIN_BACKOFFICE, sin `READ_ORGANISM` el form no
 * funciona, así que en el front toda la gestión de usuarios queda restringida a SUPERADMIN.
 * (ADMIN_BACKOFFICE/ADMIN_ORGANIZATION siguen viendo la lista en modo lectura vía `READ_USER`.)
 */
export const PERMISSION_POLICY_ROLES: Record<string, UserRole[]> = {
  CREATE_USER: [UserRole.SUPERADMIN],
  UPDATE_USER: [UserRole.SUPERADMIN],
  DELETE_USER: [UserRole.SUPERADMIN],
};
