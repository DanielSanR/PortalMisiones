import { RoleResponseDTO, RoleScopeType, PermissionResponseDTO } from '@core/models/role.model';

/**
 * DTOs del backend real para gestión de usuarios (BACKEND_API_SPEC.md §3).
 * Propios del feature usuarios. Los envelopes (ResponseDTO/MessageDTO) son compartidos (@core/models).
 * Nota: `GET /api/user` lista los usuarios del alcance (sin paginado), pero todavía sin rol, organismo ni
 * nombre (G-13).
 */

/** Perfil de entrada. `dni` y `phone` se aceptan pero NO se persisten (§3.1). */
export interface ProfileDto {
  firstName?: string;
  lastName?: string;
  cuil?: string;
  dni?: string;
  phone?: string;
}

/**
 * Body de POST /api/user (`CreateUserRequest`). `role` y `organizationId` son UUIDs.
 * Backend: email 5–50, password 8–20 (`AppConstants`), `role` @NotNull, `organizationId` sin anotación.
 */
export interface CreateUserRequest {
  email: string;
  password: string;
  role: string; // UUID del rol
  /**
   * UUID del organismo. Obligatorio de hecho si el rol es de scope `organismo` (`UserService.
   * validateOrganismScopeRequirement` → 403 `4029`); si quien crea es ADMIN_ORGANIZATION se pisa con el suyo.
   * Con un rol `global` no se valida: hay que omitirlo.
   */
  organizationId?: string;
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

/**
 * Body de POST /api/user/{id}/role-assignments (`AssignRoleRequestDTO`, permiso `CREATE_USER`).
 * Las fechas son `LocalDate` (`YYYY-MM-DD`). Sin `effectiveFrom` el backend usa hoy; sin `effectiveTo`
 * la asignación no vence. `organismId` es obligatorio para un rol de scope `organismo` y tiene que
 * faltar para uno `global` (si no → 403 `4029`).
 */
export interface AssignRoleRequest {
  roleId: string; // UUID del rol
  organismId?: string | null;
  effectiveFrom?: string;
  effectiveTo?: string;
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
