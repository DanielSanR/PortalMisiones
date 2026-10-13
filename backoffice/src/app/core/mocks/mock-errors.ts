import { Observable, throwError } from 'rxjs';

/**
 * Error de negocio simulado con la forma de un `HttpErrorResponse` del backend
 * (`{ error: { code, message } }`), para que los mocks ejerciten el mismo manejo de errores
 * (`extractErrorCode`/`extractErrorMessage`) que el backend real.
 */
export function errorDeNegocio(code: number, message: string): Observable<never> {
  return throwError(() => ({ error: { code, message } }));
}
