import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { MessageDTO } from '@core/models/api-response.model';
import { ClientApp } from '@core/models/auth.model';
import { SKIP_ERROR_INTERCEPTOR } from '@core/interceptors/http-error.interceptor';
import { CuentaDataSource } from './cuenta.datasource';

/**
 * Implementación HTTP real (`/api/email`, público). `clientApp = BACKOFFICE` para que el backend
 * arme las URLs del enlace hacia esta app.
 */
@Injectable()
export class CuentaHttpDataSource extends CuentaDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/email`;
  private readonly clientApp = ClientApp.BACKOFFICE;

  /** Estas pantallas muestran el error inline; se salta el diálogo de error global. */
  private skipGlobalError() {
    return { context: new HttpContext().set(SKIP_ERROR_INTERCEPTOR, true) };
  }

  constructor(private http: HttpClient) {
    super();
  }

  requestRecovery(mailTo: string): Observable<MessageDTO> {
    return this.http.post<MessageDTO>(
      `${this.apiUrl}/recovery`,
      { mailTo, clientApp: this.clientApp },
      this.skipGlobalError()
    );
  }

  changePassword(password: string, confirmPassword: string, token: string): Observable<MessageDTO> {
    return this.http.post<MessageDTO>(
      `${this.apiUrl}/change-pass`,
      { password, confirmPassword, token },
      this.skipGlobalError()
    );
  }
}
