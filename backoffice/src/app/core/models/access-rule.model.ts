import { UserRole } from '../enums/user-role.enum';

/**
 * Regla de acceso declarativa, reutilizada por el nav y por `accessGuard` (misma evaluación).
 * - `permissions`: acciones que habilitan (any-of por defecto; `mode:'all'` = todas). Fuente primaria.
 * - `requireRoles`: escape para secciones sin permiso atómico (ej. Auditoría, Permisos) → exige rol.
 * Sin regla (`undefined`) = accesible para cualquier usuario autenticado (ej. Dashboard/Home).
 */
export interface AccessRule {
  permissions?: string[];
  mode?: 'any' | 'all';
  requireRoles?: UserRole[];
}
