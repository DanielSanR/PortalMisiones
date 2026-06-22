import { BACKEND_TO_ENUM, UserRole } from '@core/enums/user-role.enum';
import { CreateUserRequest, UserResponseDTO } from '../models/usuario.dto';
import { Usuario } from '@core/models/usuario.model';
import { UsuarioFormValue, UsuarioVM } from '../models/usuario.vm';

/**
 * Mapea el DTO real del backend (`UserResponseDTO`) al ViewModel de la UI.
 * ⚠️ El backend NO expone `nombre`/`apellido`/`organismo` en este DTO (vienen del perfil/relaciones),
 * por eso quedan vacíos hasta que se complete con esos datos. Absorbe el `role` anidado.
 */
export function toUsuarioVM(dto: UserResponseDTO): UsuarioVM {
  const rol = dto.role?.codigo
    ? BACKEND_TO_ENUM[`ROLE_${dto.role.codigo}`] ?? UserRole.AGENT
    : UserRole.AGENT;

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
    localidadId: u.localidadId,
    activo: u.activo,
  };
}

/**
 * Construye el request real de creación. `roleId` es el UUID del rol (el backend exige UUID,
 * no el código). El form trabaja con el enum; la resolución código→UUID la hace el DataSource HTTP.
 */
export function toCreateUserRequest(form: UsuarioFormValue, roleId: string): CreateUserRequest {
  return {
    email: form.email,
    password: form.password,
    role: roleId,
    organizationId: form.organismoId ?? undefined,
    profileDto: { firstName: form.nombre, lastName: form.apellido },
  };
}
