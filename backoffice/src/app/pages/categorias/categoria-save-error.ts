import { API_CODES } from '@core/constants/api-codes.constants';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/** Conflictos de guardado de categoría que se marcan en su campo. */
export const CONFLICTOS_CATEGORIA: ConflictoDeCampo[] = [
  {
    // Unicidad del slug (409 `4072` desde el backend `586b670`; antes 400. Se decide por código).
    code: API_CODES.ENTITY_CONFLICT,
    control: 'slug',
    mensaje: 'Ya existe una categoría con ese slug',
  },
];

export const FALLBACK_CATEGORIA = 'No se pudo guardar la categoría. Intentá de nuevo.';
