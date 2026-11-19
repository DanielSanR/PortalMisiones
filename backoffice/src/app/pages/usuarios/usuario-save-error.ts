import { API_CODES } from '@core/constants/api-codes.constants';
import { extractErrorDetails } from '@core/models/api-response.model';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/**
 * Motivos del 403 `4029` del alta (`UserService.createUser`, backend `586b670`). El `message` es siempre el
 * genérico del código ("El usuario no tiene permisos para realizar esta acción."); lo que distingue el caso
 * es `details`, que el backend llena desde `messages.properties` (un solo idioma). Se compara el texto
 * entero, y también la clave, que es lo que viaja si al entorno le falta la traducción (como pasó con
 * `response.code.4080` en staging). Un `details` que no se reconoce cae en el texto neutro: nunca se
 * adivina el caso ni se muestra el texto del backend.
 *
 * ⚠️ `sinPermisoDeAlta` NO es exclusivo del alta: `UserService.forbiddenUserManagement()` reusa ese mismo
 * `details` ("…no tiene permisos para crear usuarios") para rechazar la gestión de una cuenta que ya existe
 * (cambiar el estado o el email, eliminar, asignar un rol). Por eso estos casos solo se leen en el alta
 * (`CONFLICTOS_ALTA_USUARIO`); la edición tiene los suyos (`CONFLICTOS_EDICION_USUARIO`).
 */
export const DETALLE_ALTA_DENEGADA = {
  /** El rol elegido no es asignable por quien crea (`assignableByBackoffice` / `assignableByOrgAdmin`). */
  rolRestringido: ['error.user.creation.role.restricted', 'El rol objetivo no puede ser creado por el rol autenticado.'],
  /**
   * Dos casos con el mismo texto: un Administrador de Organismo sin organismo vigente, o un rol de alcance
   * organismo que llegó sin `organizationId`.
   */
  organismoRequerido: ['error.user.creation.organization.required', 'El administrador de organización debe pertenecer a una organización.'],
  /** El rol de quien crea no es ninguno de los que pueden dar de alta usuarios. */
  sinPermisoDeAlta: ['error.user.creation.permission.denied', 'El rol autenticado no tiene permisos para crear usuarios.'],
} as const;

const conDetalle = (esperados: readonly string[]) => (body: unknown): boolean => {
  const details = extractErrorDetails(body);
  return details !== null && esperados.includes(details);
};

export const MENSAJE_ROL_RESTRINGIDO = 'No tenés permiso para crear usuarios con este rol. Elegí otro.';
export const MENSAJE_ORGANISMO_REQUERIDO = 'Falta el organismo del usuario. Si el rol elegido es de un organismo, '
  + 'indicá a cuál pertenece; si tu cuenta es de un Administrador de Organismo, todavía no tiene un organismo '
  + 'asignado: pedile a un Super Administrador que te lo asigne.';
export const MENSAJE_SIN_PERMISO_DE_ALTA = 'Tu rol no permite crear usuarios. Si necesitás hacerlo, pedile el acceso a un Super Administrador.';
export const MENSAJE_ALTA_DENEGADA = 'No tenés permiso para crear este usuario. Si creés que es un error, consultá con un Super Administrador.';

/**
 * 403 `4029` al EDITAR un usuario. El backend lo manda con el `details` del alta ("…para crear usuarios", ver
 * `DETALLE_ALTA_DENEGADA`), que acá no aplica: no se lee, y el texto habla de modificar.
 */
export const MENSAJE_EDICION_DENEGADA = 'No tenés permiso para modificar este usuario. Puede que la cuenta sea de otro '
  + 'organismo o de un administrador que tu rol no gestiona. Si creés que es un error, consultá con un Super Administrador.';

/** Unicidad del email (409 `4002`): mismo caso en el alta (`UserService.createUser`) y al cambiarlo. */
const EMAIL_REPETIDO: ConflictoDeCampo = {
  code: API_CODES.USER_ALREADY_REGISTERED,
  control: 'email',
  mensaje: 'Ya existe un usuario con ese email',
};

/**
 * Conflictos del ALTA de usuario: los que tienen `control` se marcan en su campo; el resto va al banner.
 * No usar en edición: sus textos hablan de crear.
 */
export const CONFLICTOS_ALTA_USUARIO: ConflictoDeCampo[] = [
  EMAIL_REPETIDO,
  {
    // 403 `4029` por el ROL (`validateUserCreationPermissions`): el único caso que se arregla eligiendo
    // otro rol, así que es el único que se marca en ese campo.
    code: API_CODES.NO_PERMISSION,
    cuando: conDetalle(DETALLE_ALTA_DENEGADA.rolRestringido),
    control: 'rol',
    mensaje: MENSAJE_ROL_RESTRINGIDO,
  },
  {
    // 403 `4029` por el ORGANISMO (`validateUserCreationPermissions` / `validateOrganismScopeRequirement`).
    // Sin campo: en uno de los dos casos el problema es la cuenta de quien crea, no lo que eligió.
    code: API_CODES.NO_PERMISSION,
    cuando: conDetalle(DETALLE_ALTA_DENEGADA.organismoRequerido),
    mensaje: MENSAJE_ORGANISMO_REQUERIDO,
  },
  {
    // 403 `4029` porque el rol de quien crea no da de alta usuarios: cambiar de rol en el form no lo arregla.
    code: API_CODES.NO_PERMISSION,
    cuando: conDetalle(DETALLE_ALTA_DENEGADA.sinPermisoDeAlta),
    mensaje: MENSAJE_SIN_PERMISO_DE_ALTA,
  },
  {
    // 403 `4029` sin `details` (quien crea no tiene una asignación de rol vigente, o tiene dos empatadas:
    // `requireCurrentRole` / `getCurrentAssignment`) o con uno que no se reconoce: texto neutro, sin campo.
    code: API_CODES.NO_PERMISSION,
    mensaje: MENSAJE_ALTA_DENEGADA,
  },
];

/**
 * Conflictos de la EDICIÓN de usuario. Cualquier 403 `4029` va al banner con un texto que habla de modificar,
 * sin mirar `details` (es el del alta) y sin marcar "Rol" (no hay nada que elegir distinto).
 */
export const CONFLICTOS_EDICION_USUARIO: ConflictoDeCampo[] = [
  EMAIL_REPETIDO,
  { code: API_CODES.NO_PERMISSION, mensaje: MENSAJE_EDICION_DENEGADA },
];

export const FALLBACK_USUARIO = 'No se pudo guardar el usuario. Intentá de nuevo.';
