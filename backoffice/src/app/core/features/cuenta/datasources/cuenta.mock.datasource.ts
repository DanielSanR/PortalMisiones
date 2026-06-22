import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { MessageDTO } from '@core/models/api-response.model';
import { CuentaDataSource } from './cuenta.datasource';

/** Implementación mock (dev offline): simula respuestas exitosas. */
@Injectable()
export class CuentaMockDataSource extends CuentaDataSource {
  requestRecovery(_mailTo: string): Observable<MessageDTO> {
    return of<MessageDTO>({ code: 2007, message: 'Email de recuperación enviado.', details: null }).pipe(delay(300));
  }

  changePassword(_password: string, _confirmPassword: string, _token: string): Observable<MessageDTO> {
    return of<MessageDTO>({ code: 2005, message: 'Contraseña cambiada con éxito.', details: null }).pipe(delay(300));
  }
}
