import { UserRole } from '@core/enums/user-role.enum';
import { OrganismoOption } from '@features/organismos';
import { RolVM } from '@features/roles';

/** ViewModel de usuario para la UI del backoffice (lista + formulario). */
export interface UsuarioVM {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  /** `null` si la fuente no lo informa (hoy el backend real lo manda vacío, G-13). */
  rol: UserRole | null;
  organismoId: string | null;
  organismoNombre?: string;
  activo: boolean;
}

/**
 * Valor crudo del formulario de usuario. `rol` = UUID del rol (create real) o código de rol (edición mock).
 * `organismoId` va con valor solo si el rol elegido es de scope `organismo`; para un rol `global` es `null`.
 */
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
