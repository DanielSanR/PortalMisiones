import { RoleRequestDTO, RoleResponseDTO } from '@core/models/role.model';
import { PermisoVM } from '@features/permisos';
import { RolFormValue, RolVM } from '../models/role.vm';

/** DTO del backend → ViewModel de rol (resuelve los permisos anidados). */
export function toRolVM(dto: RoleResponseDTO): RolVM {
  return {
    id: dto.id,
    codigo: dto.code,
    descripcion: dto.description ?? '',
    scopeTipo: dto.scopeType,
    asignablePorOrgAdmin: dto.assignableByOrgAdmin,
    permisos: (dto.permissions ?? []).map(
      (p): PermisoVM => ({ id: p.id, codigo: p.code, descripcion: p.description })
    ),
  };
}

/** Form → request de creación/edición. */
export function toRoleRequest(form: RolFormValue): RoleRequestDTO {
  return {
    code: form.codigo,
    description: form.descripcion,
    scopeType: form.scopeTipo,
    assignableByOrgAdmin: form.asignablePorOrgAdmin,
    active: form.active,
    permissionsIds: form.permissionsIds,
  };
}
