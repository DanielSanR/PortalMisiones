import { API_CODES } from '@core/constants/api-codes.constants';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/**
 * Errores de la asignación de rol a un usuario existente (`POST /api/user/{id}/role-assignments`,
 * `UserService.assignRole`), todos con texto propio. Los nombres de `control` son los de
 * `AsignacionRolFormValue`; si el form no tiene ese control, el texto va al banner.
 *
 * ⚠️ El backend reusa códigos cuyo `message` habla de otra cosa: `4002` llega como "El usuario ya está
 * registrado…" y `4018` como "Las contraseñas no coinciden". Por eso acá no se muestra nunca su mensaje.
 */
export const CONFLICTOS_ASIGNACION_ROL: ConflictoDeCampo[] = [
  {
    // 409: el período pedido se pisa con otra asignación del usuario (un único rol vigente).
    code: API_CODES.ROLE_ASSIGNMENT_OVERLAP,
    mensaje: 'El usuario ya tiene un rol asignado en ese período. Elegí fechas que no se superpongan con su asignación actual.',
  },
  {
    // 400: `effectiveTo` no es posterior a `effectiveFrom` (sin inicio, el backend toma hoy).
    code: API_CODES.INVALID_ELEMENT,
    control: 'vigenteHasta',
    mensaje: 'Tiene que ser posterior al inicio de la vigencia',
  },
  {
    // 404: el organismo elegido ya no existe.
    code: API_CODES.ORGANISM_NOT_FOUND,
    control: 'organismoId',
    mensaje: 'Ese organismo ya no existe. Elegí otro.',
  },
  {
    // 404: el rol elegido ya no existe. El `message` real es "Las contraseñas no coinciden".
    code: API_CODES.PASSWORD_MISMATCH_OR_ROLE,
    control: 'rolId',
    mensaje: 'Ese rol ya no existe. Elegí otro.',
  },
  {
    // 403: rol global con organismo, rol de organismo sin organismo, o quien opera no puede asignarlo
    // (backend `586b670`, PPDT-5.1: un Administrador de Backoffice solo asigna roles `assignableByBackoffice`;
    // uno de Organismo, roles `assignableByOrgAdmin` y dentro de su organismo).
    code: API_CODES.NO_PERMISSION,
    mensaje: 'No se puede asignar ese rol: puede que no tengas permiso para asignarlo (los roles de Super '
      + 'Administrador y de Administrador de Backoffice solo los asigna un Super Administrador), o que el rol y el '
      + 'organismo no se correspondan (un rol global no lleva organismo; uno de organismo lo exige).',
  },
  {
    // 409: en este flujo `4002` significa "usuario inactivo" (en el alta es "email repetido"): sin campo.
    code: API_CODES.USER_ALREADY_REGISTERED,
    mensaje: 'El usuario está inactivo. Activá la cuenta antes de asignarle un rol.',
  },
  {
    // 404: el usuario ya no existe. El `message` real invita a "registrarse".
    code: API_CODES.USER_NOT_REGISTERED,
    mensaje: 'El usuario ya no existe. Recargá el listado.',
  },
];

export const FALLBACK_ASIGNACION_ROL = 'No se pudo asignar el rol. Intentá de nuevo.';
