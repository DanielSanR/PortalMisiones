import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthTokenService } from '../services/auth-token.service';
import { getRouteData } from '../utils/route-access.utils';
import { environment } from '../../../environments/environment';

/**
 * Gating de ruta por PERMISO atómico (no por rol). Exige sesión válida y que el usuario tenga
 * alguno de los `data.permissions` declarados (any-of). En dev, `bypassAuthGuards` lo desactiva.
 *
 *   data: { permissions: ['CREATE_ROL'], redirectTo: '/dashboard/home' }
 */
export const permissionGuard: CanActivateFn = (route) => {
  if (environment.bypassAuthGuards) {
    return true;
  }

  const tokenService = inject(AuthTokenService);
  const router = inject(Router);

  if (!tokenService.hasValidSession()) {
    return router.createUrlTree(['/auth/login']);
  }

  const { permissions, redirectTo } = getRouteData(route);
  // Sin permisos declarados → ruta autenticada sin restricción de permiso específico.
  const hasAccess = !permissions || permissions.length === 0 || tokenService.hasAnyPermission(...permissions);

  return hasAccess ? true : router.createUrlTree([redirectTo || '/dashboard/home']);
};
