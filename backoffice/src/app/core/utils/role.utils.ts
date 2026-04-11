import { BACKEND_TO_ENUM, UserRole } from '../enums/user-role.enum';
import { InvalidRoleError } from '../errors/invalid-role.error';

export function normalizeBackendRole(backendRole: string): UserRole {
  const role = BACKEND_TO_ENUM[backendRole];
  if (!role) {
    throw new InvalidRoleError(backendRole);
  }
  return role;
}
