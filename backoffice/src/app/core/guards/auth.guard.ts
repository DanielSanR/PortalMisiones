import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthTokenService } from '../services/auth-token.service';
import { environment } from '../../../environments/environment';

/**
 * Protege rutas autenticadas: exige sesión con access token vigente (no expirado).
 * En dev, `environment.bypassAuthGuards` permite testear sin sesión real.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  if (environment.bypassAuthGuards) {
    return true;
  }

  const tokenService = inject(AuthTokenService);
  const router = inject(Router);

  if (tokenService.hasValidSession()) {
    return true;
  }

  // Sin sesión válida → al login conservando el destino para volver tras autenticar.
  return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};
