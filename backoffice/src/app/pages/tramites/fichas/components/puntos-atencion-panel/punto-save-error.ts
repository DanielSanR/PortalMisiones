import { FormGroup } from '@angular/forms';
import { API_CODES } from '@core/constants/api-codes.constants';
import { extractErrorCode } from '@core/models/api-response.model';
import { textoDeErrorHttp } from '@core/utils/http-error-text.utils';
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
 * `message` del backend no se muestra nunca.
 * - 403 / `4029` → sin permiso.
 * - `4012` y 404 / `4073` → `CONFLICTOS_PUNTO`.
 * - 5xx / `5000` → error del servidor.
 * - El resto → el texto propio compartido según el tipo de error (`textoDeErrorHttp`: sin conexión, sesión
 *   vencida, 409/400 sin código conocido) o `FALLBACK_PUNTO`.
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
  return textoDeErrorHttp(err, FALLBACK_PUNTO);
}

export const FALLBACK_DESACTIVAR_PUNTO = 'No se pudo desactivar el punto de atención. Intentá de nuevo.';

/**
 * Texto del error de DESACTIVAR un punto (el `errorDeAccion` del confirm). SIEMPRE un texto propio: el `4073`
 * del backend dice "El objeto AttentionPoint con el identificador … no existe.".
 */
export function puntoErrorDesactivar(err: unknown): string {
  const status = (err as { status?: number } | null)?.status;
  const code = extractErrorCode((err as { error?: unknown } | null)?.error);
  if (status === 403 || code === API_CODES.NO_PERMISSION) return 'No tenés permiso para desactivar puntos de atención.';
  if (status === 404 || code === API_CODES.ENTITY_NOT_FOUND) return 'El punto de atención ya no existe o quedó fuera de tu alcance.';
  return textoDeErrorHttp(err, FALLBACK_DESACTIVAR_PUNTO, { contexto: 'accion' });
}
