import { ActivatedRouteSnapshot } from '@angular/router';
import { UserRole } from '../enums/user-role.enum';

export interface RouteData {
  allowedRoles?: UserRole[];
  redirectTo?: string;
}

export function getRouteData(route: ActivatedRouteSnapshot): RouteData {
  return (route.data as RouteData) || {};
}
