import { ROLE_TO_SPANISH, UserRole } from '../enums/user-role.enum';
import { PERMISSION_PREREQUISITES } from '../constants/policy-overrides.constants';
import { AccessRule } from '../models/access-rule.model';

/** Lo mínimo de la sesión para evaluar autorización. */
export interface AuthzContext {
  permissions: string[];
  roles: UserRole[];
}

/**
 * ¿Puede ejecutar la acción? Debe tener el permiso Y —si la UI declara prerrequisitos— los permisos y
 * alguno de los roles que la pantalla necesita. Es la única función que conoce
 * `PERMISSION_PREREQUISITES`; nav, guards y botones la consumen (directa o vía `evaluateAccess`),
 * garantizando consistencia entre las 3 capas.
 */
export function canPerform(ctx: AuthzContext, permission: string): boolean {
  if (!ctx.permissions.includes(permission)) return false;
  const pre = PERMISSION_PREREQUISITES[permission];
  if (!pre) return true;
  const permisosOk = (pre.permissions ?? []).every((p) => ctx.permissions.includes(p));
  const rolesOk = !pre.roles?.length || pre.roles.some((r) => ctx.roles.includes(r));
  return permisosOk && rolesOk;
}

/** Evalúa una `AccessRule` (permiso primario + escape por rol + alternativas `anyOf`). Sin regla = permitido. */
export function evaluateAccess(ctx: AuthzContext, rule: AccessRule | undefined): boolean {
  if (!rule) return true;
  const perms = rule.permissions ?? [];
  const permOk =
    perms.length === 0
      ? true
      : rule.mode === 'all'
        ? perms.every((p) => canPerform(ctx, p))
        : perms.some((p) => canPerform(ctx, p));
  const roleOk = !rule.requireRoles?.length || rule.requireRoles.some((r) => ctx.roles.includes(r));
  const alternativasOk = !rule.anyOf?.length || rule.anyOf.some((alt) => evaluateAccess(ctx, alt));
  return permOk && roleOk && alternativasOk;
}

/**
 * Etiqueta de rol para display: rol canónico traducido, rol custom "prettified", o "Sin rol asignado".
 * La autorización NO depende de esto (es solo presentación).
 */
export function resolveRoleLabel(roleCodes: string[], role: UserRole | null): string {
  if (role) return ROLE_TO_SPANISH[role];
  const custom = roleCodes[0];
  if (!custom) return 'Sin rol asignado';
  return custom.charAt(0).toUpperCase() + custom.slice(1).toLowerCase().replace(/_/g, ' ');
}
