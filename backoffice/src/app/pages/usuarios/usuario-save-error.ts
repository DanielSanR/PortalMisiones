import { API_CODES } from '@core/constants/api-codes.constants';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/** Conflictos de guardado de usuario que se marcan en su campo. */
export const CONFLICTOS_USUARIO: ConflictoDeCampo[] = [
  {
    // Unicidad del email (409 `4002`, `UserService.createUser`).
    code: API_CODES.USER_ALREADY_REGISTERED,
    control: 'email',
    mensaje: 'Ya existe un usuario con ese email',
  },
];

export const FALLBACK_USUARIO = 'No se pudo guardar el usuario. Intentá de nuevo.';
