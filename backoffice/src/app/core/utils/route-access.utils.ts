import { ActivatedRouteSnapshot } from '@angular/router';
import { AccessRule } from '../models/access-rule.model';

export interface RouteData {
  /** Regla de acceso (permisos + excepciones de política), evaluada por `accessGuard`. */
  access?: AccessRule;
  redirectTo?: string;
}

export function getRouteData(route: ActivatedRouteSnapshot): RouteData {
  return (route.data as RouteData) || {};
}
