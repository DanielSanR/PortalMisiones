import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MessageDTO } from '@core/models/api-response.model';
import { CuentaRepository } from '../repositories/cuenta.repository';

/**
 * Facade de Cuenta — comandos de recuperación de contraseña (públicos). Expone Observables
 * (los componentes usan `firstValueFrom` para el one-shot). Sin estado.
 */
@Injectable({ providedIn: 'root' })
export class CuentaFacade {
  constructor(private cuenta: CuentaRepository) {}

  /** Solicita el email de recuperación (el usuario debe existir y estar activo). */
  requestRecovery(mailTo: string): Observable<MessageDTO> {
    return this.cuenta.requestRecovery(mailTo);
  }

  /** Cambia la contraseña vía token del enlace. Revoca todas las sesiones del usuario. */
  changePassword(password: string, confirmPassword: string, token: string): Observable<MessageDTO> {
    return this.cuenta.changePassword(password, confirmPassword, token);
  }
}
