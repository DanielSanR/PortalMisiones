import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { MessageDTO } from '@core/models/api-response.model';

/**
 * Fuente de datos de cuenta — comandos públicos de recuperación de contraseña
 * (BACKEND_API_SPEC.md §6.1). Sin lectura/estado: solo comandos.
 */
export abstract class CuentaDataSource {
  abstract requestRecovery(mailTo: string): Observable<MessageDTO>;
  abstract changePassword(password: string, confirmPassword: string, token: string): Observable<MessageDTO>;
}

export const CUENTA_DS = new InjectionToken<CuentaDataSource>('CUENTA_DS');
