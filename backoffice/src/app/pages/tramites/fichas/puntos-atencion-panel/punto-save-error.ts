import { FormGroup } from '@angular/forms';
import { Observable, catchError, throwError } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { extractErrorCode } from '@core/models/api-response.model';
import { ConflictoDeCampo, aplicarErrorDeGuardado } from '@core/utils/save-error.utils';

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

export const TEXTO_PUNTO_SIN_PERMISO = 'No tenés permiso para guardar puntos de atención en esta ficha.';

/** 5xx / `5000`: el backend no dice qué pasó, y nada indica que sea un dato del formulario. */
export const TEXTO_PUNTO_ERROR_SERVIDOR =
  'El servidor no pudo guardar el punto de atención. No es un problema de lo que cargaste: esperá un momento e intentá de nuevo. '
  + 'Si sigue, avisá a Soporte.';

/**
 * Texto del error de GUARDAR un punto de atención (alta o edición), ya traducido. SIEMPRE un texto propio: el
 * `message` del backend no se muestra nunca (`aplicarErrorDeGuardado` solo, sin esto, cae en él cuando el
 * código no está en `CONFLICTOS_PUNTO`).
 * - 403 / `4029` → sin permiso.
 * - `4012` y 404 / `4073` → `CONFLICTOS_PUNTO`.
 * - 5xx / `5000` → error del servidor.
 * - El resto (sin conexión, código desconocido) → `FALLBACK_PUNTO`.
 */
export function puntoErrorGuardado(err: unknown, form: FormGroup | undefined): string {
  const status = (err as { status?: number } | null)?.status;
  const code = extractErrorCode((err as { error?: unknown } | null)?.error);
  if (status === 403 || code === API_CODES.NO_PERMISSION) return TEXTO_PUNTO_SIN_PERMISO;
  if (CONFLICTOS_PUNTO.some((c) => c.code === code)) return aplicarErrorDeGuardado(err, form, CONFLICTOS_PUNTO, FALLBACK_PUNTO);
  // Un 404 sin el código de negocio (proxy, ruta) es el mismo caso para quien guarda.
  if (status === 404) return CONFLICTOS_PUNTO.find((c) => c.code === API_CODES.ENTITY_NOT_FOUND)!.mensaje;
  if (code === API_CODES.UNEXPECTED || code === API_CODES.DB_ERROR || (typeof status === 'number' && status >= 500)) {
    return TEXTO_PUNTO_ERROR_SERVIDOR;
  }
  return FALLBACK_PUNTO;
}

/**
 * Para el confirm "Desactivar": el `ConfirmDialogComponent` muestra `error.message` tal cual, y el
 * `4073` del backend dice "El objeto AttentionPoint con el identificador … no existe.".
 */
export function conMensajeDePunto<T>(accion$: Observable<T>): Observable<T> {
  return accion$.pipe(catchError((err: unknown) => {
    const status = (err as { status?: number } | null)?.status;
    const code = extractErrorCode((err as { error?: unknown } | null)?.error);
    const message = status === 403 || code === API_CODES.NO_PERMISSION
      ? 'No tenés permiso para desactivar puntos de atención.'
      : status === 404 || code === API_CODES.ENTITY_NOT_FOUND
        ? 'El punto de atención ya no existe o quedó fuera de tu alcance.'
        : 'No se pudo desactivar el punto de atención. Intentá de nuevo.';
    return throwError(() => ({ error: { message } }));
  }));
}
