import { RoleRequestDTO, RoleResponseDTO } from '@core/models/role.model';
import { PermisoVM } from '@features/permisos';
import { RolFormValue, RolVM } from '../models/role.vm';

/** DTO del backend → ViewModel de rol (resuelve los permisos anidados). */
export function toRolVM(dto: RoleResponseDTO): RolVM {
  return {
    id: dto.id,
    codigo: dto.codigo,
    descripcion: dto.description ?? '',
    scopeTipo: dto.scopeTipo,
    asignablePorOrgAdmin: dto.asignablePorOrgAdmin,
    permisos: (dto.permissions ?? []).map(
      (p): PermisoVM => ({ id: p.id, codigo: p.codigo, descripcion: p.descripcion })
    ),
  };
}

/** Form → request de creación/edición. */
export function toRoleRequest(form: RolFormValue): RoleRequestDTO {
  return {
    codigo: form.codigo,
    description: form.descripcion,
    scopeTipo: form.scopeTipo,
    asignablePorOrgAdmin: form.asignablePorOrgAdmin,
    active: form.active,
    permissionsIds: form.permissionsIds,
  };
}
