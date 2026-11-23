import { RoleRequestDTO, RoleResponseDTO } from '@core/models/role.model';
import { PermisoVM } from '@features/permisos';
import { RolFormValue, RolVM } from '../models/role.vm';

/** DTO del backend → ViewModel de rol (resuelve los permisos anidados). */
export function toRolVM(dto: RoleResponseDTO): RolVM {
  return {
    id: dto.id,
    codigo: dto.code,
    descripcion: dto.description ?? '',
    descripcionGuardada: dto.description ?? null,
    scopeTipo: dto.scopeType,
    asignablePorOrgAdmin: dto.assignableByOrgAdmin,
    asignablePorBackoffice: dto.assignableByBackoffice ?? false,
    activo: dto.active ?? true,
    permisos: (dto.permissions ?? []).map(
      (p): PermisoVM => ({ id: p.id, codigo: p.code, descripcion: p.description })
    ),
  };
}

/**
 * Rol ya cargado → valor de edición con otro estado. Para cambiar solo `active` por `PUT`: el backend
 * reemplaza todo el rol, así que el resto (permisos incluidos) tiene que viajar tal como está.
 */
export function rolConEstado(rol: RolVM, active: boolean): RolFormValue {
  return {
    codigo: rol.codigo,
    descripcion: rol.descripcion,
    scopeTipo: rol.scopeTipo,
    asignablePorOrgAdmin: rol.asignablePorOrgAdmin,
    asignablePorBackoffice: rol.asignablePorBackoffice,
    active,
    permissionsIds: rol.permisos.map((permiso) => permiso.id),
  };
}

/**
 * Rol leído recién del backend → `PUT` que solo lo reactiva: todo como vino (la descripción también, aunque sea
 * `null`: el `PUT` reemplaza el rol entero) y `active: true`.
 */
export function pedidoDeActivacion(rol: RolVM): RoleRequestDTO {
  const pedido = toRoleRequest(rolConEstado(rol, true));
  return rol.descripcionGuardada === undefined ? pedido : { ...pedido, description: rol.descripcionGuardada };
}

/** Form → request de creación/edición. */
export function toRoleRequest(form: RolFormValue): RoleRequestDTO {
  return {
    code: form.codigo,
    description: form.descripcion,
    scopeType: form.scopeTipo,
    assignableByOrgAdmin: form.asignablePorOrgAdmin,
    // Siempre presente: un PUT sin el flag lo resetea a `false` en el backend.
    assignableByBackoffice: form.asignablePorBackoffice,
    active: form.active,
    permissionsIds: form.permissionsIds,
  };
}
