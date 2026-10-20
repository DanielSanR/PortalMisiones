import { UserRole } from '../enums/user-role.enum';

export interface AuthUser {
  id: string;
  email: string;
  /** El backend NO incluye nombre/apellido en el JWT; vienen del perfil (endpoint aparte). */
  nombre: string;
  apellido: string;
  /** Rol canónico de mayor privilegio, o `null` si el usuario solo tiene rol(es) custom. */
  role: UserRole | null;
  /** Roles canónicos reconocidos del claim `roles` (para excepciones de política / multi-rol). */
  roles: UserRole[];
  /** TODOS los códigos de rol (canónicos + custom, sin prefijo ROLE_), para display. */
  roleCodes: string[];
  /** Permisos atómicos del claim `roles` (sin prefijo ROLE_) — fuente primaria de autorización. */
  permissions: string[];
  organismoId?: string | null;
}
// Para pasar en el payload
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

/** Claims reales del access/refresh token (BACKEND_API_SPEC.md §1.2). */
/**
 * `GET /api/auth/me` → contexto EFECTIVO del usuario autenticado (fuente de verdad del RBAC).
 * `roles` viene con prefijo `ROLE_`; `permissions`, los códigos atómicos.
 */
export interface AuthMeResponseDTO {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface JwtPayload {
  sub: string; // email
  /**
   * Autoridades. Dos formatos tolerados (ver `parseAuthorities`):
   *  - viejo: string coma-separado que mezcla `ROLE_*` y permisos ("ROLE_SUPERADMIN,READ_USUARIO");
   *  - nuevo: array de `ROLE_*` (con `permissions` en claim aparte).
   */
  roles: string | string[];
  /** Formato nuevo: permisos atómicos en un claim separado. */
  permissions?: string[];
  userId: string; // UUID
  iat: number;
  exp: number;
  jti?: string; // solo en refresh token
  // No emitidos por el backend hoy; opcionales para forward-compat / mocks.
  nombre?: string;
  apellido?: string;
  organismoId?: string | null;
}

/** Enum del cliente origen, exigido por register y email/recovery. */
export enum ClientApp {
  BACKOFFICE = 'BACKOFFICE',
  PORTAL = 'PORTAL',
}
