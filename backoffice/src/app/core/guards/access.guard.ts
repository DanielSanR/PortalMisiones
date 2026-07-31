import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthTokenService } from '../services/auth-token.service';
import { getRouteData } from '../utils/route-access.utils';
import { evaluateAccess } from '../utils/authorization.utils';
import { environment } from '../../../environments/environment';

/**
 * Guard único de autorización POR PERMISO. Exige sesión válida y que la `data.access` (AccessRule)
 * se cumpla, evaluada con `evaluateAccess` — la misma función que filtra el nav, de modo que nav y
 * ruta nunca se desalineen (incl. las excepciones de política como crear/eliminar usuarios).
 * En dev, `bypassAuthGuards` lo desactiva.
 *
 *   data: { access: { permissions: ['READ_USER', 'UPDATE_USER'] }, redirectTo: '/dashboard/home' }
 */
export const accessGuard: CanActivateFn = (route) => {
  if (environment.bypassAuthGuards) {
    return true;
  }

  const tokenService = inject(AuthTokenService);
  const router = inject(Router);

  if (!tokenService.hasValidSession()) {
    return router.createUrlTree(['/auth/login']);
  }

  const { access, redirectTo } = getRouteData(route);
  const ctx = { permissions: tokenService.getPermissions(), roles: tokenService.getUserRoles() };

  return evaluateAccess(ctx, access) ? true : router.createUrlTree([redirectTo || '/dashboard/home']);
};
