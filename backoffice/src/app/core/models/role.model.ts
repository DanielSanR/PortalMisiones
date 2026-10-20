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
  /** ¿ADMIN_BACKOFFICE puede asignar este rol? (V2.16, PPDT-5.1). Opcional: un backend anterior a V2.16 no lo manda. */
  assignableByBackoffice?: boolean;
  active: boolean; // desde d800be0 el response ya expone `active` (§4.3, ítem G)
  permissions: PermissionResponseDTO[];
}

export interface RoleRequestDTO {
  code: string;
  description?: string;
  scopeType: RoleScopeType;
  assignableByOrgAdmin: boolean;
  /** ¿ADMIN_BACKOFFICE puede asignar este rol? (V2.16, PPDT-5.1). En el PUT se manda siempre: si falta, el backend lo toma como `false`. */
  assignableByBackoffice: boolean;
  active: boolean;
  permissionsIds: string[];
}
