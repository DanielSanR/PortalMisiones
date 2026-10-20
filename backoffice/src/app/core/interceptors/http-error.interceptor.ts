import { HttpContext, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { HttpErrorService } from '../services/http-error.service';

export const SKIP_ERROR_INTERCEPTOR = new HttpContextToken<boolean>(() => false);

/**
 * Opciones de request para las llamadas cuyo error ya cuenta la pantalla (banner del form,
 * modal de confirmación). Sin esto el usuario ve el mismo error dos veces: inline y en el
 * diálogo global.
 */
export const sinDialogoGlobal = () => ({ context: new HttpContext().set(SKIP_ERROR_INTERCEPTOR, true) });

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorService = inject(HttpErrorService);

  if (req.context.get(SKIP_ERROR_INTERCEPTOR)) {
    return next(req);
  }

  return next(req).pipe(
    catchError((error) => {
      const isBlobRequest = req.responseType === 'blob';
      // Los 401 los gestiona el auth.interceptor (refresh/rotación o re-login),
      // así que no mostramos diálogo de error para ellos.
      if (!isBlobRequest && error?.status !== 401) {
        errorService.handleHttpError(error);
      }
      return throwError(() => error);
    })
  );
};
