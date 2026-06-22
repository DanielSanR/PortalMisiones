import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MessageDTO } from '@core/models/api-response.model';
import { CUENTA_DS, CuentaDataSource } from '../datasources/cuenta.datasource';

/** Repositorio de cuenta (comandos de recuperación). Inyecta el DataSource vía token. */
@Injectable({ providedIn: 'root' })
export class CuentaRepository {
  constructor(@Inject(CUENTA_DS) private ds: CuentaDataSource) {}

  requestRecovery(mailTo: string): Observable<MessageDTO> {
    return this.ds.requestRecovery(mailTo);
  }

  changePassword(password: string, confirmPassword: string, token: string): Observable<MessageDTO> {
    return this.ds.changePassword(password, confirmPassword, token);
  }
}
