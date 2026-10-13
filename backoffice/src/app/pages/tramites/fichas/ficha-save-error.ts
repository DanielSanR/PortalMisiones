import { Observable, catchError, throwError } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { extractErrorCode, extractErrorMessage } from '@core/models/api-response.model';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/**
 * Texto prudente para el `5000` de las fichas (decisión de §8, R-2/G-4): el backend responde 500 a
 * casi todo (transición inválida, ficha/adopción/localidad inexistente o fuera del alcance, campo
 * obligatorio faltante) y no dice cuál fue.
 */
export const TEXTO_5000_FICHA = 'Puede que la ficha haya cambiado de estado; recargá e intentá de nuevo.';

/** Errores de guardado de una ficha con texto propio (`OrganismProcedureLocationService`). Van al banner. */
export const CONFLICTOS_FICHA: ConflictoDeCampo[] = [
  {
    code: API_CODES.UNEXPECTED,
    mensaje: 'Puede que la ficha haya cambiado, o que el trámite del organismo o la localidad ya no estén disponibles. Recargá e intentá de nuevo.',
  },
  {
    // Hoy el backend no valida el DTO (G-1); cuando lo haga, un campo obligatorio faltante será `4012`.
    code: API_CODES.VALIDATION,
    mensaje: 'Revisá los campos obligatorios: localidad y slug.',
  },
  {
    // G-4 propone `4073` para "no existe o fuera del alcance" (hoy llega como `5000`).
    code: API_CODES.ENTITY_NOT_FOUND,
    mensaje: 'La ficha, el trámite del organismo o la localidad ya no existe o quedó fuera de tu alcance. Recargá e intentá de nuevo.',
  },
  {
    // G-9 propone un `409`/`4072` para slug repetido (hoy no hay unicidad: lo valida el form).
    code: API_CODES.ENTITY_CONFLICT,
    control: 'slug',
    mensaje: 'Ya hay otra ficha con ese slug. Elegí otro.',
  },
];

export const FALLBACK_FICHA = 'No se pudo guardar la ficha. Intentá de nuevo.';

/**
 * Texto del error de una acción sobre la ficha (workflow o desactivar), ya traducido. Sin permiso →
 * lo dice; `5000` → el texto prudente; el resto, lo que mande el backend.
 */
export function mensajeErrorAccion(err: unknown): string {
  const status = (err as { status?: number } | null)?.status;
  const body = (err as { error?: unknown } | null)?.error;
  const code = extractErrorCode(body);
  if (status === 403 || code === API_CODES.NO_PERMISSION) return 'No tenés permiso para hacer esto con la ficha.';
  if (code === API_CODES.UNEXPECTED || status === 500) return `No se pudo completar la acción. ${TEXTO_5000_FICHA}`;
  if (status === 404 || code === API_CODES.ENTITY_NOT_FOUND) return 'La ficha ya no existe o quedó fuera de tu alcance.';
  return extractErrorMessage(body) || 'No se pudo completar la acción. Intentá de nuevo.';
}

/**
 * Envuelve una acción para el `ConfirmDialogComponent`, que muestra `error.message` tal cual: así ve
 * el texto prudente y no "Ocurrió un error inesperado. Contacte al administrador.".
 */
export function conMensajeDeAccion<T>(accion$: Observable<T>): Observable<T> {
  return accion$.pipe(catchError((err: unknown) => throwError(() => ({ error: { message: mensajeErrorAccion(err) } }))));
}

/**
 * ¿El error de una lectura dice que la ficha no existe? Hoy el backend responde `5000` también para
 * eso (G-4), así que solo se reconoce el 404/`4073` futuro; el resto cae en el error genérico.
 */
export function esFichaInexistente(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  const code = extractErrorCode((err as { error?: unknown } | null)?.error);
  return status === 404 || code === API_CODES.ENTITY_NOT_FOUND;
}

export const TEXTOS_FICHA_INEXISTENTE = {
  titulo: 'Esa ficha no existe',
  texto: 'Puede que el enlace esté mal escrito o que la ficha no sea de tu organismo. Buscala en el listado.',
} as const;

/** Error de carga genérico: el backend no distingue "no existe" de otros errores (G-4). */
export const TEXTOS_FICHA_ERROR_CARGA = {
  titulo: 'No pudimos cargar la ficha',
  texto: 'Puede que no exista, que no sea de tu organismo o que haya un problema de conexión. Intentá de nuevo; si sigue, avisá a Soporte.',
} as const;

/** Texto de "no se pudo resolver el nombre" (sin permiso para leerlo, o sin G-1). */
export const NO_DISPONIBLE = 'No disponible';
