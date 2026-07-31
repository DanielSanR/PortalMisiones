import { BACKEND_TO_ENUM, ROLE_PRIORITY, UserRole } from '../enums/user-role.enum';

const ROLE_PREFIX = 'ROLE_';

export interface ParsedAuthorities {
  /** Roles reconocidos (autoridades con prefijo ROLE_ mapeadas al enum). */
  roles: UserRole[];
  /** TODOS los códigos de rol sin prefijo (canónicos + custom, ej. `SUPERADMIN`, `TEST`). Para display. */
  roleCodes: string[];
  /** Permisos atómicos (autoridades sin prefijo, p. ej. READ_USUARIO). */
  permissions: string[];
}

/** Payload del JWT en lo relativo a autoridades. Tolera dos formatos (ver `parseAuthorities`). */
export interface AuthoritiesClaim {
  /** Formato viejo: string coma-separado que mezcla ROLE_* y permisos. Formato nuevo: array de `ROLE_*`. */
  roles: string | string[];
  /** Formato nuevo: permisos en un claim aparte. Si viene, `roles` se trata como solo-roles. */
  permissions?: string[];
}

/**
 * Separa las autoridades del JWT en roles y permisos. Tolera DOS formatos:
 *  - **Viejo**: un único claim `roles` coma-separado que mezcla `ROLE_*` y permisos crudos
 *    (`"ROLE_SUPERADMIN,READ_USUARIO,..."`). Se separa por el prefijo `ROLE_`.
 *  - **Nuevo**: `roles` = array de `ROLE_*` y `permissions` = array aparte de códigos de permiso.
 * Los roles llevan prefijo `ROLE_`; los canónicos se mapean al enum, los custom quedan solo en `roleCodes`.
 */
export function parseAuthorities(claim: AuthoritiesClaim): ParsedAuthorities {
  const roleAuthorities = Array.isArray(claim.roles)
    ? claim.roles.map((a) => a.trim()).filter(Boolean)
    : (claim.roles ?? '').split(',').map((a) => a.trim()).filter(Boolean);

  const hasSeparatePermissions = Array.isArray(claim.permissions);

  const roles: UserRole[] = [];
  const roleCodes: string[] = [];
  const permissions: string[] = hasSeparatePermissions ? [...(claim.permissions as string[])] : [];

  for (const authority of roleAuthorities) {
    if (authority.startsWith(ROLE_PREFIX)) {
      roleCodes.push(authority.slice(ROLE_PREFIX.length)); // guarda TODOS (incl. custom) para display
      const role = BACKEND_TO_ENUM[authority];
      if (role) roles.push(role); // solo los canónicos van al enum
    } else if (!hasSeparatePermissions) {
      permissions.push(authority); // formato viejo: no-ROLE en `roles` = permiso
    }
  }

  return { roles, roleCodes, permissions };
}

/** Devuelve el rol de mayor privilegio según ROLE_PRIORITY (null si la lista está vacía). */
export function pickHighestRole(roles: UserRole[]): UserRole | null {
  if (roles.length === 0) return null;
  return roles.reduce((best, current) =>
    ROLE_PRIORITY.indexOf(current) > ROLE_PRIORITY.indexOf(best) ? current : best
  );
}
