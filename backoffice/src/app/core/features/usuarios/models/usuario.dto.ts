import { RoleResponseDTO, RoleScopeType, PermissionResponseDTO } from '@core/models/role.model';

/**
 * DTOs del backend real para gestión de usuarios (BACKEND_API_SPEC.md §3).
 * Propios del feature usuarios. Los envelopes (ResponseDTO/MessageDTO) son compartidos (@core/models).
 * Nota: el backend NO expone listado/paginado de usuarios (sólo GET por id).
 */

/** Perfil de entrada. `dni` y `phone` se aceptan pero NO se persisten (§3.1). */
export interface ProfileDto {
  firstName?: string;
  lastName?: string;
  cuil?: string;
  dni?: string;
  phone?: string;
}

/** Body de POST /api/user (`CreateUserRequest`). `role` y `organizationId` son UUIDs. */
export interface CreateUserRequest {
  email: string;
  password: string;
  role: string; // UUID del rol
  organizationId?: string; // UUID; para ADMIN_ORGANIZATION se sobreescribe con su org
  profileDto?: ProfileDto;
}

/** Rol embebido dentro de UserResponseDTO. */
export interface UserRoleSummary {
  id: string;
  code: string;
  description: string;
  scopeType: RoleScopeType;
  assignableByOrgAdmin: boolean;
  permissions: PermissionResponseDTO[];
}

/**
 * Respuesta de usuario (`UserResponseDTO`).
 * ⚠️ El timestamp se serializa literal como `lockeTime` (typo del backend).
 * `cuit`/`cuil`/`activeAssignments` pueden venir null.
 */
export interface UserResponseDTO {
  id: string;
  email: string;
  cuit: string | null;
  cuil: string | null;
  accountActive: boolean;
  accountNonLocked: boolean;
  failedAttempts: number;
  lockeTime: string | null;
  role: UserRoleSummary | null;
  activeAssignments: RoleResponseDTO[] | null;
  profileComplete: boolean;
}

/** PUT /api/user/{id}/change-password */
export interface ChangePasswordRequest {
  newPassword: string;
}

/** PATCH /api/user/{id}/change-email */
export interface ChangeEmailRequest {
  newEmail: string;
}

/** PUT /api/user/{id}/status-account */
export interface StatusAccountRequest {
  accountActive: boolean;
}

/** PUT /api/user/update-profile (usuario autenticado). Todos requeridos. */
export interface ProfileUpdateRequest {
  firstName: string;
  lastName: string;
  cuil: string;
}
