import { API_CODES } from '@core/constants/api-codes.constants';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/** Conflictos de guardado de permiso que se marcan en su campo. */
export const CONFLICTOS_PERMISO: ConflictoDeCampo[] = [
  {
    // Unicidad del código (409 `4062`, alta y edición).
    code: API_CODES.PERMISSION_ALREADY_EXISTS,
    control: 'codigo',
    mensaje: 'Ya existe un permiso con ese código',
  },
];

export const FALLBACK_PERMISO = 'No se pudo guardar el permiso. Intentá de nuevo.';
