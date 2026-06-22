/** Roles y permisos del backend real (BACKEND_API_SPEC.md §4). */

/** Columna `roles.scope_tipo` (CHECK IN ('global','organismo')). */
export type RoleScopeType = 'global' | 'organismo';

export interface PermissionResponseDTO {
  id: string;
  codigo: string; // formato ACCION_RECURSO
  descripcion: string;
}

export interface PermissionRequestDTO {
  codigo: string;
  descripcion: string;
}

export interface RoleResponseDTO {
  id: string;
  codigo: string; // sin prefijo ROLE_
  description: string;
  scopeTipo: RoleScopeType;
  asignablePorOrgAdmin: boolean;
  permissions: PermissionResponseDTO[];
}

export interface RoleRequestDTO {
  codigo: string;
  description?: string;
  scopeTipo: RoleScopeType;
  asignablePorOrgAdmin: boolean;
  active: boolean;
  permissionsIds: string[];
}
