import { API_CODES } from '@core/constants/api-codes.constants';
import { extractErrorCode } from '@core/models/api-response.model';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/** Errores de guardado de una adopción con texto propio (`OrganismProcedureService`). Van al banner. */
export const CONFLICTOS_ADOPCION: ConflictoDeCampo[] = [
  {
    // 409 `4080`: otra adopción habilitada de la misma plantilla en el mismo organismo se pisa con
    // estas fechas. El backend no tiene texto para este código (llega "response.code.4080").
    code: API_CODES.ADOPTION_OVERLAP,
    mensaje: 'Ya hay una adopción vigente de este trámite en el organismo para ese período. Cambiá las fechas o editá la adopción existente.',
  },
  {
    // 400 `4012`: `effectiveTo` no es posterior a `effectiveFrom` (o falta un campo obligatorio).
    // El texto del backend es genérico ("Verifique los campos..."): se dice qué revisar.
    code: API_CODES.VALIDATION,
    mensaje: 'Revisá la vigencia: la fecha de fin tiene que ser posterior a la de inicio.',
  },
  {
    // 404 `4073`: la adopción, la plantilla o el organismo no existe, está desactivado o quedó fuera
    // del alcance del usuario. El backend no dice cuál.
    code: API_CODES.ENTITY_NOT_FOUND,
    mensaje: 'La plantilla o el organismo ya no existe, está desactivado o quedó fuera de tu alcance. Recargá e intentá de nuevo.',
  },
];

export const FALLBACK_ADOPCION = 'No se pudo guardar. Intentá de nuevo.';

/**
 * ¿El error de una lectura dice que la adopción no existe (o está fuera del alcance)? (404 / `4073`).
 * Se mira por forma y no por `HttpErrorResponse`: el mock tira `{ error: { code } }` sin status.
 */
export function esAdopcionInexistente(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  const code = extractErrorCode((err as { error?: unknown } | null)?.error);
  return status === 404 || code === API_CODES.ENTITY_NOT_FOUND;
}

export const TEXTOS_ADOPCION_INEXISTENTE = {
  titulo: 'Ese trámite del organismo no existe',
  texto: 'Puede que el enlace esté mal escrito o que no esté entre los trámites de tu organismo. Buscalo en el listado.',
} as const;

/** Texto de "no se pudo resolver el nombre" (sin permiso para leerlo, o id que ya no está). */
export const NO_DISPONIBLE = 'No disponible';
