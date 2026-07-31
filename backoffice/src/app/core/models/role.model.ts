/** Roles y permisos del backend real (BACKEND_API_SPEC.md §4). */

/** Columna `roles.scope_tipo` (CHECK IN ('global','organismo')). */
export type RoleScopeType = 'global' | 'organismo';

export interface PermissionResponseDTO {
  id: string;
  code: string; // formato ACCION_RECURSO
  description: string;
}

export interface PermissionRequestDTO {
  code: string;
  description: string;
}

export interface RoleResponseDTO {
  id: string;
  code: string; // sin prefijo ROLE_
  description: string;
  scopeType: RoleScopeType;
  assignableByOrgAdmin: boolean;
  permissions: PermissionResponseDTO[];
}

export interface RoleRequestDTO {
  code: string;
  description?: string;
  scopeType: RoleScopeType;
  assignableByOrgAdmin: boolean;
  active: boolean;
  permissionsIds: string[];
}
