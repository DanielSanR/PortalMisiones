import { ActivatedRouteSnapshot } from '@angular/router';
import { UserRole } from '../enums/user-role.enum';

export interface RouteData {
  allowedRoles?: UserRole[];
  /** Permisos atómicos requeridos por la ruta (any-of), para `permissionGuard`. */
  permissions?: string[];
  redirectTo?: string;
}

export function getRouteData(route: ActivatedRouteSnapshot): RouteData {
  return (route.data as RouteData) || {};
}
