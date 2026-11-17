import { BACKEND_TO_ENUM } from '@core/enums/user-role.enum';
import { AssignRoleRequest, CreateUserRequest, UserResponseDTO } from '../models/usuario.dto';
import { Usuario } from '@core/models/usuario.model';
import { AsignacionRolFormValue, UsuarioFormValue, UsuarioVM } from '../models/usuario.vm';

/**
 * Mapea el DTO real del backend (`UserResponseDTO`) al ViewModel de la UI.
 * ⚠️ El backend NO expone `nombre`/`apellido`/`organismo` en este DTO (vienen del perfil/relaciones),
 * por eso quedan vacíos. El rol sale de `role` o, si no viene, de la primera asignación vigente; hoy
 * (G-13) los dos llegan vacíos y queda `null`: nunca se inventa un rol.
 */
export function toUsuarioVM(dto: UserResponseDTO): UsuarioVM {
  const codigo = dto.role?.code ?? dto.activeAssignments?.[0]?.code;
  const rol = codigo ? BACKEND_TO_ENUM[`ROLE_${codigo.replace(/^ROLE_/, '')}`] ?? null : null;

  return {
    id: dto.id,
    nombre: '',
    apellido: '',
    email: dto.email,
    rol,
    organismoId: null,
    activo: dto.accountActive,
  };
}

/** Mapea el ViewModel mock (`Usuario`) al VM de la UI (casi identidad). */
export function mockUsuarioToVM(u: Usuario): UsuarioVM {
  return {
    id: u.id,
    nombre: u.nombre,
    apellido: u.apellido,
    email: u.email,
    rol: u.rol,
    organismoId: u.organismoId,
    organismoNombre: u.organismoNombre,
    activo: u.activo,
  };
}

/**
 * Construye el request real de creación. `roleId` es el UUID del rol (el backend exige UUID, no el
 * código); en el alta el form ya trabaja con el UUID del catálogo `/api/role/allowed`.
 * `organizationId` solo viaja si el form trae organismo (rol de scope `organismo`).
 */
export function toCreateUserRequest(form: UsuarioFormValue, roleId: string): CreateUserRequest {
  return {
    email: form.email,
    password: form.password,
    role: roleId,
    organizationId: form.organismoId || undefined,
    profileDto: { firstName: form.nombre, lastName: form.apellido },
  };
}

/**
 * Construye el request real de asignación de rol. Lo que el form deja vacío se omite: el backend pone
 * hoy como inicio y deja la asignación sin fin. El organismo solo viaja si hay (rol de scope `organismo`).
 */
export function toAssignRoleRequest(form: AsignacionRolFormValue): AssignRoleRequest {
  return {
    roleId: form.rolId,
    organismId: form.organismoId || undefined,
    effectiveFrom: form.vigenteDesde || undefined,
    effectiveTo: form.vigenteHasta || undefined,
  };
}
