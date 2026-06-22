import { BACKEND_TO_ENUM, ROLE_PRIORITY, UserRole } from '../enums/user-role.enum';

const ROLE_PREFIX = 'ROLE_';

export interface ParsedAuthorities {
  /** Roles reconocidos (autoridades con prefijo ROLE_ mapeadas al enum). */
  roles: UserRole[];
  /** Permisos atómicos (autoridades sin prefijo, p. ej. READ_USUARIO). */
  permissions: string[];
}

/**
 * Separa el claim `roles` del JWT en roles y permisos.
 *
 * El backend (CustomeUserDetails) emite TODAS las autoridades en un único claim coma-separado:
 * los roles llevan prefijo `ROLE_` (p. ej. `ROLE_SUPERADMIN`) y los permisos van como su código
 * crudo (`READ_USUARIO`, `DELETE_ROL`, ...). Un usuario puede traer varios roles y muchos permisos.
 */ 
export function parseAuthorities(rolesClaim: string): ParsedAuthorities {
  const authorities = (rolesClaim ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);

  const roles: UserRole[] = [];
  const permissions: string[] = [];

  for (const authority of authorities) {
    if (authority.startsWith(ROLE_PREFIX)) {
      const role = BACKEND_TO_ENUM[authority];
      if (role) roles.push(role); // ignora roles desconocidos
    } else {
      permissions.push(authority);
    }
  }

  return { roles, permissions };
}

/** Devuelve el rol de mayor privilegio según ROLE_PRIORITY (null si la lista está vacía). */
export function pickHighestRole(roles: UserRole[]): UserRole | null {
  if (roles.length === 0) return null;
  return roles.reduce((best, current) =>
    ROLE_PRIORITY.indexOf(current) > ROLE_PRIORITY.indexOf(best) ? current : best
  );
}
