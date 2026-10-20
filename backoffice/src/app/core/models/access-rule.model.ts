import { UserRole } from '../enums/user-role.enum';

/**
 * Regla de acceso declarativa, reutilizada por el nav y por `accessGuard` (misma evaluación).
 * - `permissions`: acciones que habilitan (any-of por defecto; `mode:'all'` = todas). Fuente primaria.
 * - `requireRoles`: escape para secciones sin permiso atómico (ej. Auditoría, Permisos) → exige rol.
 * - `anyOf`: además, debe cumplirse AL MENOS UNA de estas sub-reglas (alternativas, p. ej. "tiene
 *   `READ_ORGANISM` o es admin provincial"; ver `CREAR_ETIQUETA_ACCESS`). Vacío/ausente = sin condición.
 * Sin regla (`undefined`) = accesible para cualquier usuario autenticado (ej. Dashboard/Home).
 */
export interface AccessRule {
  permissions?: string[];
  mode?: 'any' | 'all';
  requireRoles?: UserRole[];
  anyOf?: AccessRule[];
}
