import { UserRole } from '@core/enums/user-role.enum';
import { OrganismoOption } from '@features/organismos';
import { RolVM } from '@features/roles';

/** ViewModel de usuario para la UI del backoffice (lista + formulario). */
export interface UsuarioVM {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: UserRole;
  organismoId: string | null;
  organismoNombre?: string;
  activo: boolean;
}

/** Valor crudo del formulario de usuario. `rol` = UUID del rol (create real) o código de rol (edición mock). */
export interface UsuarioFormValue {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol: string;
  organismoId: string | null;
}

/** Datos que necesita el formulario, resueltos en una sola llamada (orquestación del facade). */
export interface UsuarioFormData {
  organismos: OrganismoOption[];
  rolesAllowed: RolVM[];
  usuario: UsuarioVM | null;
}
