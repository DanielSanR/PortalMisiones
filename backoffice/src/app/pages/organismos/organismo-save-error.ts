import { API_CODES } from '@core/constants/api-codes.constants';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/** Conflictos de guardado de organismo que se marcan en su campo (alta y ficha en modo editar). */
export const CONFLICTOS_ORGANISMO: ConflictoDeCampo[] = [
  {
    // Unicidad global de la sigla (`acronym` en el DTO), incluidas las bajas (409 `4069`).
    code: API_CODES.ORGANISM_ACRONYM_TAKEN,
    control: 'acronym',
    mensaje: 'Ya existe un organismo con esa sigla (también cuentan los dados de baja)',
  },
];

export const FALLBACK_ORGANISMO = 'No se pudo guardar el organismo. Intentá de nuevo.';
