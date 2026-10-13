import { API_CODES } from '@core/constants/api-codes.constants';
import { extractErrorCode } from '@core/models/api-response.model';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/** Errores de guardado de una plantilla con texto propio (`ProcedureTemplateService`). */
export const CONFLICTOS_PLANTILLA: ConflictoDeCampo[] = [
  {
    // Slug repetido — 400 `4072`. Es único entre TODAS las plantillas, también las desactivadas
    // (que no se listan): por eso el texto no promete que se vea en el listado.
    code: API_CODES.ENTITY_CONFLICT,
    control: 'slug',
    mensaje: 'Ya existe una plantilla con ese slug (puede ser una desactivada). Elegí otro.',
  },
  {
    // 404 `4073`: la plantilla, o alguno de los ids elegidos (modalidad, categorías, etiquetas,
    // destinatarios, eventos de vida), ya no existe. El backend no dice cuál: va al banner.
    code: API_CODES.ENTITY_NOT_FOUND,
    mensaje: 'La plantilla o algo de lo que elegiste (modalidad, categorías, etiquetas, destinatarios o eventos de vida) ya no existe. Recargá la página e intentá de nuevo.',
  },
];

export const FALLBACK_PLANTILLA = 'No se pudo guardar la plantilla. Intentá de nuevo.';

/**
 * ¿El error de una lectura dice que la plantilla no existe? (404 / `4073`). Se mira por forma y no
 * por `HttpErrorResponse`: el mock tira `{ error: { code } }` sin status.
 */
export function esPlantillaInexistente(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  const code = extractErrorCode((err as { error?: unknown } | null)?.error);
  return status === 404 || code === API_CODES.ENTITY_NOT_FOUND;
}

/** Textos del panel "no existe", compartidos por el form y el detalle. */
export const TEXTOS_PLANTILLA_INEXISTENTE = {
  titulo: 'Esa plantilla no existe',
  texto: 'Puede que el enlace esté mal escrito. Buscala en el listado.',
} as const;
