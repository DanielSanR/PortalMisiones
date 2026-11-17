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

/**
 * Asignación de rol a un usuario existente. Un usuario tiene un único rol vigente: el período pedido no
 * puede superponerse con ninguna de sus asignaciones. Fechas de día completo, `YYYY-MM-DD`.
 */
export interface AsignacionRolFormValue {
  /** UUID del rol (catálogo `/api/role/allowed`). */
  rolId: string;
  /** Con valor solo si el rol es de scope `organismo`; para un rol `global` es `null`. */
  organismoId: string | null;
  /** Inicio de la vigencia; `null` = desde hoy. */
  vigenteDesde: string | null;
  /** Fin de la vigencia (posterior al inicio); `null` = sin fin. */
  vigenteHasta: string | null;
}

/**
 * Quién está operando la lista de usuarios, ya reducido a lo que la pantalla necesita: de eso depende qué
 * roles y organismo se ofrecen en el alta, y qué fila es "mi cuenta".
 */
export interface SesionUsuariosVM {
  usuarioId: string | null;
  email: string | null;
  esSuperAdmin: boolean;
  organismoId: string | null;
}

/** Datos que necesita el formulario, resueltos en una sola llamada (orquestación del facade). */
export interface UsuarioFormData {
  organismos: OrganismoOption[];
  rolesAllowed: RolVM[];
  usuario: UsuarioVM | null;
}
