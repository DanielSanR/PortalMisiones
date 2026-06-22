import { UserRole } from '../enums/user-role.enum';

export interface AuthUser {
  id: string;
  email: string;
  /** El backend NO incluye nombre/apellido en el JWT; vienen del perfil (endpoint aparte). */
  nombre: string;
  apellido: string;
  /** Rol de mayor privilegio derivado del claim `roles`. */
  role: UserRole;
  /** Todos los roles del claim `roles` (para RBAC multi-rol en guards). */
  roles: UserRole[];
  /** Permisos atómicos del claim `roles` (sin prefijo ROLE_), para gating fino en la UI. */
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
export interface JwtPayload {
  sub: string; // email
  roles: string; // autoridades separadas por coma, p. ej. "ROLE_SUPERADMIN,ROLE_AGENT"
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
