/**
 * Roles reales del backend . El `codigo` NO lleva prefijo `ROLE_`,
 * pero la autoridad en el JWT (claim `roles`) sí: `hasRole('X')` ⇒ autoridad `ROLE_X`.
 */
export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN_BACKOFFICE = 'ADMIN_BACKOFFICE',
  ADMIN_ORGANIZATION = 'ADMIN_ORGANIZATION',
  AGENT = 'AGENT',
  MANAGER = 'MANAGER',
  USER = 'USER',
}

export const ROLE_TO_SPANISH: Record<UserRole, string> = {
  [UserRole.SUPERADMIN]: 'Super Administrador',
  [UserRole.ADMIN_BACKOFFICE]: 'Administrador de Backoffice',
  [UserRole.ADMIN_ORGANIZATION]: 'Administrador de Organismo',
  [UserRole.AGENT]: 'Operador',
  [UserRole.MANAGER]: 'Visualizador',
  [UserRole.USER]: 'Usuario',
};

/** Autoridad del JWT (con prefijo ROLE_) → enum. */
export const BACKEND_TO_ENUM: Record<string, UserRole> = {
  ROLE_SUPERADMIN: UserRole.SUPERADMIN,
  ROLE_ADMIN_BACKOFFICE: UserRole.ADMIN_BACKOFFICE,
  ROLE_ADMIN_ORGANIZATION: UserRole.ADMIN_ORGANIZATION,
  ROLE_AGENT: UserRole.AGENT,
  ROLE_MANAGER: UserRole.MANAGER,
  ROLE_USER: UserRole.USER,
};

/**
 * Prioridad para elegir el rol "principal" cuando el JWT trae varias autoridades
 * (claim `roles` = autoridades separadas por coma). Mayor índice = mayor privilegio.
 */
export const ROLE_PRIORITY: UserRole[] = [
  UserRole.USER,
  UserRole.MANAGER,
  UserRole.AGENT,
  UserRole.ADMIN_ORGANIZATION,
  UserRole.ADMIN_BACKOFFICE,
  UserRole.SUPERADMIN,
];
