import { PermissionRequestDTO, PermissionResponseDTO } from '@core/models/role.model';
import { PermisoFormValue, PermisoVM } from '../models/permiso.vm';

/** DTO del backend → ViewModel de permiso. */
export function toPermisoVM(dto: PermissionResponseDTO): PermisoVM {
  return { id: dto.id, codigo: dto.codigo, descripcion: dto.descripcion };
}

/** Form → request de creación/edición. */
export function toPermissionRequest(form: PermisoFormValue): PermissionRequestDTO {
  return { codigo: form.codigo, descripcion: form.descripcion };
}
