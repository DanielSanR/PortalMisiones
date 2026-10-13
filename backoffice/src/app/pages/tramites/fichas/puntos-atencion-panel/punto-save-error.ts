import { Observable, catchError, throwError } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { extractErrorCode } from '@core/models/api-response.model';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/** Errores de guardado de un punto de atención con texto propio (`AttentionPointService`). Van al banner. */
export const CONFLICTOS_PUNTO: ConflictoDeCampo[] = [
  {
    // 400 `4012`: campo obligatorio vacío o coordenada fuera de rango. El texto del backend es genérico.
    code: API_CODES.VALIDATION,
    mensaje: 'Revisá los campos obligatorios y que la latitud esté entre -90 y 90 y la longitud entre -180 y 180.',
  },
  {
    // 404 `4073`: la ficha o el punto no existe o está fuera del alcance del usuario.
    code: API_CODES.ENTITY_NOT_FOUND,
    mensaje: 'La ficha o el punto de atención ya no existe o quedó fuera de tu alcance. Recargá e intentá de nuevo.',
  },
];

export const FALLBACK_PUNTO = 'No se pudo guardar el punto de atención. Intentá de nuevo.';

/**
 * Para el confirm "Desactivar": el `ConfirmDialogComponent` muestra `error.message` tal cual, y el
 * `4073` del backend dice "El objeto AttentionPoint con el identificador … no existe.".
 */
export function conMensajeDePunto<T>(accion$: Observable<T>): Observable<T> {
  return accion$.pipe(catchError((err: unknown) => {
    const status = (err as { status?: number } | null)?.status;
    const code = extractErrorCode((err as { error?: unknown } | null)?.error);
    const message = status === 403
      ? 'No tenés permiso para desactivar puntos de atención.'
      : status === 404 || code === API_CODES.ENTITY_NOT_FOUND
        ? 'El punto de atención ya no existe o quedó fuera de tu alcance.'
        : 'No se pudo desactivar el punto de atención. Intentá de nuevo.';
    return throwError(() => ({ error: { message } }));
  }));
}
