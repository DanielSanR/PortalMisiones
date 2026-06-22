/**
 * Envelopes y tipos de respuesta del backend real (PortalMisiones-backend).
 * Ver BACKEND_API_SPEC.md §1.5 y §1.6.
 *
 * El backend NO usa un único formato:
 *  - La mayoría de endpoints de éxito devuelven `ResponseDTO<T>` (`{ details, code, data }`).
 *  - Operaciones tipo comando (sin payload) y errores de negocio devuelven `MessageDTO`.
 *  - Errores de la capa de seguridad (filtros JWT) devuelven `ErrorDTO`.
 *  - `POST /api/auth/refresh` devuelve un objeto PLANO (`RefreshTokenResponseDTO`), sin wrapper.
 *
 * `code` es siempre un CÓDIGO DE NEGOCIO interno (ver API_CODES), NO el HTTP status.
 */

/** Envelope de éxito de la mayoría de endpoints. El texto va en `details`, el payload en `data`. */
export interface ResponseDTO<T> {
  details: string | null;
  code: number;
  data: T;
}

/** Usado por comandos sin payload y por el GlobalExceptionHandler. El texto va en `message`. */
export interface MessageDTO {
  code: number;
  message: string;
  details: string | null;
}

/** Cuerpo de error emitido por la capa de seguridad (no pasa por el @RestControllerAdvice). */
export interface ErrorDTO {
  date: string;
  code: number;
  message: string;
  details: string | null;
  path: string;
  listDetails: Record<string, unknown> | null;
}

/** Tokens emitidos por login / activate-account (dentro de `ResponseDTO<JwtDTO>`). */
export interface JwtDTO {
  accessToken: string;
  refreshToken: string;
}

/** Respuesta PLANA de `POST /api/auth/refresh` (sin wrapper ResponseDTO). */
export interface RefreshTokenResponseDTO {
  accessToken: string;
  refreshToken: string;
}

/**
 * Extrae el texto legible de cualquier cuerpo de error del backend
 * (ResponseDTO.details, MessageDTO.message o ErrorDTO.message).
 */
export function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b['message'] === 'string' && b['message']) return b['message'] as string;
  if (typeof b['details'] === 'string' && b['details']) return b['details'] as string;
  return null;
}
