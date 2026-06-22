import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Endpoints públicos de auth: no llevan Bearer ni disparan refresh
 * (login, register, refresh, activate-account → todos bajo /api/auth/).
 */
const AUTH_PUBLIC = '/api/auth/';

// Single-flight: si llegan varios 401 a la vez, sólo se refresca una vez y el resto espera.
let isRefreshing = false;
const refreshedToken$ = new BehaviorSubject<string | null>(null);

function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (req.url.includes(AUTH_PUBLIC)) {
    return next(req);
  }

  const token = authService.getAccessToken();
  const authReq = token ? addToken(req, token) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Sólo intentamos rotación si teníamos un access token (el 401 = expirado/ inválido).
      if (error.status !== 401 || !token) {
        return throwError(() => error);
      }

      const refreshToken = authService.getRefreshToken();
      if (!refreshToken) {
        authService.logout();
        router.navigate(['/auth/login']);
        return throwError(() => error);
      }

      // Hay un refresh en curso: esperarlo y reintentar con el nuevo token.
      if (isRefreshing) {
        return refreshedToken$.pipe(
          filter((t): t is string => t !== null),
          take(1),
          switchMap((newToken) => next(addToken(req, newToken)))
        );
      }

      isRefreshing = true;
      refreshedToken$.next(null);

      return authService.refreshToken(refreshToken).pipe(
        switchMap((tokens) => {
          isRefreshing = false;
          refreshedToken$.next(tokens.accessToken);
          return next(addToken(req, tokens.accessToken));
        }),
        catchError((refreshError) => {
          // Refresh inválido/expirado/revocado (code 4064) → cerrar sesión.
          isRefreshing = false;
          authService.logout();
          router.navigate(['/auth/login']);
          return throwError(() => refreshError);
        })
      );
    })
  );
};
