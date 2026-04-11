import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthTokenService } from '../services/auth-token.service';
import { getRouteData } from '../utils/route-access.utils';

export const roleGuard: CanActivateFn = (route, _state) => {
  const authService = inject(AuthTokenService);
  const router = inject(Router);

  const user = authService.getCurrentUser();

  if (!user) {
    router.navigate(['/auth/login']);
    return true;
    /* return false; */
  }

  const data = getRouteData(route);
  const hasAccess = data.allowedRoles?.includes(user.role) ?? true;

  if (!hasAccess) {
    router.navigate([data.redirectTo || '/dashboard/home']);
    /* return false; */
    return true;
  }

  return true;
};
