export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN_ORGANISMO = 'ADMIN_ORGANISMO',
  EDITOR = 'EDITOR',
}

export type UserRoleDisplay = 'superadmin' | 'admin_organismo' | 'editor';

export const ROLE_TO_DISPLAY: Record<UserRole, UserRoleDisplay> = {
  [UserRole.SUPERADMIN]: 'superadmin',
  [UserRole.ADMIN_ORGANISMO]: 'admin_organismo',
  [UserRole.EDITOR]: 'editor',
};

export const ROLE_TO_SPANISH: Record<UserRole, string> = {
  [UserRole.SUPERADMIN]: 'Super Administrador',
  [UserRole.ADMIN_ORGANISMO]: 'Administrador de Organismo',
  [UserRole.EDITOR]: 'Editor',
};

export const BACKEND_TO_ENUM: Record<string, UserRole> = {
  ROLE_SUPERADMIN: UserRole.SUPERADMIN,
  ROLE_ADMIN_ORGANISMO: UserRole.ADMIN_ORGANISMO,
  ROLE_EDITOR: UserRole.EDITOR,
};
