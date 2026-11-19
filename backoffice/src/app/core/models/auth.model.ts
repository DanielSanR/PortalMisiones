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
  /**
   * Alcance de la sesión según `GET /api/auth/me` (backend `dev` @ `586b670`, G-2): `global` (SUPERADMIN,
   * ADMIN_BACKOFFICE, MANAGER) u `organismo` (ADMIN_ORGANIZATION, AGENT). `null`/ausente = el backend
   * todavía no lo informa (o `/me` falló): la UI se comporta como antes de G-2.
   */
  scope?: SessionScope | null;
  /**
   * Organismo del usuario (`organismId` de `/me`; con un backend viejo, el claim `organismoId` del JWT si
   * existiera). `null` en sesiones globales. Para consumirlo, preferir `AuthTokenService.getUserOrganismo()`.
   */
  organismoId?: string | null;
  /** `organismName` de `/me`. */
  organismoNombre?: string | null;
  /** `organismAcronym` de `/me`. */
  organismoSigla?: string | null;
}

/** Alcance de la sesión (`AuthMeResponseDTO.scope`). */
export type SessionScope = 'global' | 'organismo';

/**
 * Organismo al que pertenece la sesión, listo para mostrar o para armar la opción de un select sin
 * pedir `GET /api/organism` (el rol puede no tener `READ_ORGANISM`).
 */
export interface OrganismoDeSesion {
  id: string;
  /** Nombre visible: `organismName`; si faltara, la sigla. */
  nombre: string;
  sigla: string | null;
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
 * `roles` viene con prefijo `ROLE_`; `permissions`, los códigos atómicos. Desde `586b670` suma el alcance
 * y el organismo del usuario (`AuthService.getCurrentAuthContext`).
 */
export interface AuthMeResponseDTO {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  // Desde `586b670` (G-2). Opcionales: un backend anterior no los manda.
  /** `"global"` | `"organismo"`. */
  scope?: string | null;
  /** UUID; `null` en roles globales. */
  organismId?: string | null;
  organismName?: string | null;
  organismAcronym?: string | null;
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
