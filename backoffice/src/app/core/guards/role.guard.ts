import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthTokenService } from '../services/auth-token.service';
import { getRouteData } from '../utils/route-access.utils';
import { environment } from '../../../environments/environment';

/**
 * RBAC por ruta: bloquea de verdad si el usuario no tiene ninguno de los `allowedRoles`
 * declarados en `route.data`. Soporta multi-rol. En dev, `bypassAuthGuards` lo desactiva.
 */
export const roleGuard: CanActivateFn = (route) => {
  if (environment.bypassAuthGuards) {
    return true;
  }

  const tokenService = inject(AuthTokenService);
  const router = inject(Router);

  if (!tokenService.hasValidSession()) {
    return router.createUrlTree(['/auth/login']);
  }

  const { allowedRoles, redirectTo } = getRouteData(route);
  // Sin restricción declarada → ruta autenticada sin RBAC específico.
  const hasAccess = !allowedRoles || allowedRoles.length === 0 || tokenService.hasAnyRole(allowedRoles);

  return hasAccess ? true : router.createUrlTree([redirectTo || '/dashboard/home']);
};
