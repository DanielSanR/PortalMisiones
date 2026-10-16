import { HttpErrorResponse } from '@angular/common/http';
import { extractErrorMessage } from '../../core/models/api-response.model';
import { NoBackofficeAccessError } from '../../core/errors/no-backoffice-access.error';

export const LOGIN_SIN_CONEXION =
  'No pudimos conectarnos con el servidor. Revisá tu conexión o que el servicio esté disponible e intentá de nuevo.';
export const LOGIN_SERVIDOR_CAIDO =
  'El servidor no está disponible en este momento. Intentá de nuevo en unos minutos.';
export const LOGIN_CREDENCIALES = 'El email o la contraseña no son correctos.';
export const LOGIN_INESPERADO = 'No pudimos iniciar sesión. Intentá de nuevo.';

/**
 * Texto del error de login según su causa real. Antes cualquier falla (incluido un error de red o un
 * bloqueo de CORS, `status 0`) se mostraba como "Credenciales inválidas", y el usuario buscaba el
 * problema en su contraseña.
 */
export function mensajeErrorLogin(err: unknown): string {
  if (err instanceof NoBackofficeAccessError) return err.message;

  if (err instanceof HttpErrorResponse) {
    // Sin respuesta del servidor: caído, sin red, puerto ocupado por otro servicio o CORS.
    if (err.status === 0) return LOGIN_SIN_CONEXION;
    if (err.status >= 500) return LOGIN_SERVIDOR_CAIDO;
    // 4xx: el backend explica el motivo (contraseña incorrecta, cuenta inactiva, usuario inexistente…).
    const delServidor = extractErrorMessage(err.error);
    if (delServidor) return delServidor;
    if (err.status === 401 || err.status === 400) return LOGIN_CREDENCIALES;
    return LOGIN_INESPERADO;
  }

  return LOGIN_INESPERADO;
}
