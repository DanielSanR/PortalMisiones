import { HttpErrorResponse } from '@angular/common/http';
import { API_CODES } from '@core/constants/api-codes.constants';
import { extractErrorCode } from '@core/models/api-response.model';
import { NoBackofficeAccessError } from '@core/errors/no-backoffice-access.error';

export const LOGIN_SIN_CONEXION =
  'No pudimos conectarnos con el servidor. Revisá tu conexión o que el servicio esté disponible e intentá de nuevo.';
export const LOGIN_SERVIDOR_CAIDO =
  'El servidor no está disponible en este momento. Intentá de nuevo en unos minutos.';
export const LOGIN_CREDENCIALES = 'El email o la contraseña no son correctos.';
export const LOGIN_CUENTA_INACTIVA =
  'Tu cuenta no está activa. Si recibiste un correo de activación, usá ese enlace; si no, pedile a un administrador que la active.';
/**
 * `4030`: el backend lo manda para CUALQUIER cuenta inactiva sin token de activación pendiente
 * (`AuthService.login`): tanto la eliminada como la que desactivó un administrador. El texto no afirma cuál.
 */
export const LOGIN_CUENTA_ELIMINADA =
  'Esta cuenta está desactivada o dada de baja. Si creés que es un error, consultá con un administrador.';
/**
 * `4015` (este intento agotó los permitidos y la bloqueó) y `4014` (ya estaba bloqueada). Sin tiempo de
 * espera: el backend solo lo manda dentro del `message` ("Tiempo restante: N minutos."), que no se muestra
 * ni se interpreta. Mientras dura el bloqueo no importa si la contraseña es correcta: por eso no la culpa.
 */
export const LOGIN_CUENTA_BLOQUEADA =
  'Tu cuenta está bloqueada por varios intentos fallidos. Esperá un momento antes de volver a intentar: '
  + 'mientras dure el bloqueo no vas a poder entrar aunque la contraseña sea correcta.';
/** `4013`: el bloqueo venció y este intento desbloqueó la cuenta, pero el backend no inicia sesión en el mismo pedido. */
export const LOGIN_CUENTA_DESBLOQUEADA = 'Tu cuenta se desbloqueó. Volvé a intentar.';
export const LOGIN_INESPERADO = 'No pudimos iniciar sesión. Intentá de nuevo; si sigue, avisá a Soporte.';

/**
 * Texto del error de login según su causa real. Antes cualquier falla (incluido un error de red o un
 * bloqueo de CORS, `status 0`) se mostraba como "Credenciales inválidas", y el usuario buscaba el
 * problema en su contraseña. Siempre un texto propio: el `message` del backend no se muestra.
 */
export function mensajeErrorLogin(err: unknown): string {
  if (err instanceof NoBackofficeAccessError) return err.message;

  if (err instanceof HttpErrorResponse) {
    // Sin respuesta del servidor: caído, sin red, puerto ocupado por otro servicio o CORS.
    if (err.status === 0) return LOGIN_SIN_CONEXION;
    if (err.status >= 500) return LOGIN_SERVIDOR_CAIDO;
    // 4xx: el motivo se lee del CÓDIGO de negocio, nunca del `message` del backend. Contraseña incorrecta
    // (401 `4016`) y email inexistente (404 `4023`) comparten texto a propósito: no se revela qué emails tienen cuenta.
    const code = extractErrorCode(err.error);
    if (code === API_CODES.ACCOUNT_INACTIVE) return LOGIN_CUENTA_INACTIVA;
    if (code === API_CODES.ACCOUNT_DELETED) return LOGIN_CUENTA_ELIMINADA;
    // Bloqueo por intentos fallidos (401, como la contraseña incorrecta): sin esto la persona seguía probando
    // contraseñas sin saber que tenía que esperar.
    if (code === API_CODES.ACCOUNT_LOCKED || code === API_CODES.ACCOUNT_LOCKED_WAIT) return LOGIN_CUENTA_BLOQUEADA;
    if (code === API_CODES.ACCOUNT_UNLOCKED) return LOGIN_CUENTA_DESBLOQUEADA;
    if (code === API_CODES.WRONG_PASSWORD || code === API_CODES.USER_NOT_FOUND_LOGIN || code === API_CODES.USER_NOT_REGISTERED) {
      return LOGIN_CREDENCIALES;
    }
    if (err.status === 401 || err.status === 400 || err.status === 404) return LOGIN_CREDENCIALES;
    return LOGIN_INESPERADO;
  }

  return LOGIN_INESPERADO;
}
