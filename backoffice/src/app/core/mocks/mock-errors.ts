import { Observable, throwError } from 'rxjs';
import { API_CODES } from '../constants/api-codes.constants';

/** HTTP 409: el status de los conflictos (duplicado `4072`, solapamiento `4080`…) desde el backend `586b670`. */
export const HTTP_CONFLICT = 409;

/**
 * HTTP status con el que el backend real (`dev` @ `586b670`) acompaña cada código de negocio que los mocks
 * simulan, tomado de los `new GlobalAppException(HttpStatus.X, código, …)` de sus servicios. Es la única
 * fuente del status en los mocks: quien llama a `errorDeNegocio` no lo elige, así no puede olvidarlo ni
 * desalinearlo. Al simular un código nuevo, sumarlo acá con el status de su servicio.
 *
 * `4019` es 404 en `UserService` (el uso de los mocks); el 401 de `AuthService.getCurrentAuthContext` no
 * se simula.
 */
export const STATUS_DE_CODIGO: Readonly<Record<number, number>> = {
  // 409 — unicidad, solapamiento, estado que no admite la operación, edición concurrente.
  [API_CODES.USER_ALREADY_REGISTERED]: HTTP_CONFLICT,
  [API_CODES.ROLE_ALREADY_EXISTS]: HTTP_CONFLICT,
  [API_CODES.PERMISSION_ALREADY_EXISTS]: HTTP_CONFLICT,
  [API_CODES.ORGANISM_TYPE_CODE_TAKEN]: HTTP_CONFLICT,
  [API_CODES.ORGANISM_TYPE_IN_USE]: HTTP_CONFLICT,
  [API_CODES.ORGANISM_HAS_CHILDREN]: HTTP_CONFLICT,
  [API_CODES.ORGANISM_PARENT_IS_DESCENDANT]: HTTP_CONFLICT,
  [API_CODES.ORGANISM_ACRONYM_TAKEN]: HTTP_CONFLICT,
  [API_CODES.ORGANISM_PARENT_IS_SELF]: HTTP_CONFLICT,
  [API_CODES.RELATED_ENTITY_INACTIVE]: HTTP_CONFLICT,
  [API_CODES.ENTITY_CONFLICT]: HTTP_CONFLICT,
  [API_CODES.LIFE_EVENT_ASSIGNED]: HTTP_CONFLICT,
  [API_CODES.PUBLICATION_TRANSITION_INVALID]: HTTP_CONFLICT,
  [API_CODES.ADOPTION_OVERLAP]: HTTP_CONFLICT,
  [API_CODES.ROLE_ASSIGNMENT_OVERLAP]: HTTP_CONFLICT,
  [API_CODES.CONCURRENT_MODIFICATION]: HTTP_CONFLICT,
  // 400 — el pedido no pasa la validación.
  [API_CODES.INVALID_ELEMENT]: 400,
  [API_CODES.VALIDATION]: 400,
  [API_CODES.CATEGORY_HAS_CHILDREN]: 400,
  [API_CODES.CATEGORY_PARENT_IS_SELF]: 400,
  [API_CODES.CATEGORY_PARENT_IS_DESCENDANT]: 400,
  // 403 — sin permiso para la acción.
  [API_CODES.NO_PERMISSION]: 403,
  // 404 — el recurso (o uno referenciado) no existe.
  [API_CODES.PASSWORD_MISMATCH_OR_ROLE]: 404,
  [API_CODES.USER_NOT_REGISTERED]: 404,
  [API_CODES.ORGANISM_TYPE_NOT_FOUND]: 404,
  [API_CODES.ORGANISM_NOT_FOUND]: 404,
  [API_CODES.ENTITY_NOT_FOUND]: 404,
  // 500
  [API_CODES.UNEXPECTED]: 500,
};

/** Status de un código que no está en {@link STATUS_DE_CODIGO}: el de un rechazo de negocio genérico. */
export const STATUS_POR_DEFECTO = 400;

/**
 * Error de negocio simulado con la forma de un `HttpErrorResponse` del backend
 * (`{ status, error: { code, message } }`), para que los mocks ejerciten el mismo manejo de errores
 * (`extractErrorCode`/`extractErrorMessage`) que el backend real. SIEMPRE lleva `status`: el que el backend
 * usa para ese código ({@link STATUS_DE_CODIGO}; `STATUS_POR_DEFECTO` si el código no está en la tabla). Las
 * pantallas deciden por `code`, pero el mock simula igual el status para que un manejo que lo mire (el
 * interceptor, un `if (err.status === 409)`) no pase desapercibido en mock.
 *
 * El tercer parámetro solo existe para un caso que el backend responda con un status distinto al habitual
 * de ese código; lo normal es no pasarlo.
 */
export function errorDeNegocio(code: number, message: string, status: number = statusDeCodigo(code)): Observable<never> {
  return throwError(() => ({ status, error: { code, message } }));
}

/** El HTTP status que el backend real usa para `code`. */
export function statusDeCodigo(code: number): number {
  return STATUS_DE_CODIGO[code] ?? STATUS_POR_DEFECTO;
}
