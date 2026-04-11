import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { HttpErrorService } from '../services/http-error.service';

export const SKIP_ERROR_INTERCEPTOR = new HttpContextToken<boolean>(() => false);

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorService = inject(HttpErrorService);

  if (req.context.get(SKIP_ERROR_INTERCEPTOR)) {
    return next(req);
  }

  return next(req).pipe(
    catchError((error) => {
      const isBlobRequest = req.responseType === 'blob';
      if (!isBlobRequest) {
        errorService.handleHttpError(error);
      }
      return throwError(() => error);
    })
  );
};
