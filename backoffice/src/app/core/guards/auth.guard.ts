import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthTokenService } from '../services/auth-token.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthTokenService);
  const router = inject(Router);

  return authService.getCurrentUser$().pipe(
    map((user) => {
      if (user) {
        return true;
      }
      router.navigate(['/auth/login'], {
        queryParams: { returnUrl: state.url },
      });
      /* return false; */
      return true;
    })
  );
};
