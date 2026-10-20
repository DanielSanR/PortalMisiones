import { API_CODES } from '@core/constants/api-codes.constants';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/** Conflictos de guardado de etiqueta que se marcan en su campo. */
export const CONFLICTOS_ETIQUETA: ConflictoDeCampo[] = [
  {
    // Slug repetido en el mismo alcance (global u organismo) — 400 `4072`.
    code: API_CODES.TAXONOMY_CONFLICT,
    control: 'slug',
    mensaje: 'Ya existe una etiqueta con ese slug en ese alcance (global u organismo)',
  },
  {
    // Fuera de alcance (404 `4073`): ADMIN_ORGANIZATION/AGENT solo crean etiquetas locales de SU
    // organismo; elegir otro, o "global", lo rechaza `TagService.validateScope`.
    code: API_CODES.TAXONOMY_NOT_FOUND,
    control: 'organismoId',
    mensaje: 'Solo podés crear etiquetas locales de tu organismo',
  },
];

export const FALLBACK_ETIQUETA = 'No se pudo guardar la etiqueta. Intentá de nuevo.';
