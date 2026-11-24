import { Injectable } from '@angular/core';
import { Observable, defer, filter, map } from 'rxjs';
import { MessageDTO } from '@core/models/api-response.model';
import { AuthUser } from '@core/models/auth.model';
import { AuthTokenService } from '@core/services/auth-token.service';
import { CuentaRepository } from '../repositories/cuenta.repository';
import { SesionDeCuentaVM } from '../models/cuenta.vm';

/**
 * Facade de Cuenta — comandos de recuperación de contraseña (públicos) y la sesión que muestra "Mi perfil".
 * Expone Observables (los componentes usan `firstValueFrom` para el one-shot). Sin estado propio.
 *
 * Excepción documentada: sesión en facades (`.claude/rules/arquitectura-capas.md`, caso 4). `AuthTokenService` se
 * consulta SOLO para `sesion$`: "Mi perfil" muestra la cuenta en curso y `pages/` no puede inyectar la sesión.
 */
@Injectable({ providedIn: 'root' })
export class CuentaFacade {
  /**
   * Usuario de la sesión y su rol legible, cada vez que la sesión cambia (login, refresco de `/me`). Sin sesión no
   * emite: la pantalla que lo usa está detrás del `authGuard`. `defer`: lee la sesión al suscribirse.
   */
  readonly sesion$: Observable<SesionDeCuentaVM> = defer(() => this.auth.getCurrentUser$()).pipe(
    filter((usuario): usuario is AuthUser => !!usuario),
    map((usuario) => ({ usuario, rol: this.auth.getUserRoleLabel() })),
  );

  constructor(
    private cuenta: CuentaRepository,
    private auth: AuthTokenService,
  ) {}

  /** Solicita el email de recuperación (el usuario debe existir y estar activo). */
  requestRecovery(mailTo: string): Observable<MessageDTO> {
    return this.cuenta.requestRecovery(mailTo);
  }

  /** Cambia la contraseña vía token del enlace. Revoca todas las sesiones del usuario. */
  changePassword(password: string, confirmPassword: string, token: string): Observable<MessageDTO> {
    return this.cuenta.changePassword(password, confirmPassword, token);
  }
}
