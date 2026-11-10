import { API_CODES } from '@core/constants/api-codes.constants';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/** Conflictos de guardado de rol que se marcan en su campo. */
export const CONFLICTOS_ROL: ConflictoDeCampo[] = [
  {
    // Unicidad del código (409 `4061`, alta y edición).
    code: API_CODES.ROLE_ALREADY_EXISTS,
    control: 'codigo',
    mensaje: 'Ya existe un rol con ese código',
  },
];

export const FALLBACK_ROL = 'No se pudo guardar el rol. Intentá de nuevo.';
