import { Injectable, inject } from '@angular/core';
import { Observable, defer, filter, map } from 'rxjs';
import { MessageDTO } from '@core/models/api-response.model';
import { AuthUser } from '@core/models/auth.model';
import { FilasPorPagina, Preferencias } from '@core/models/preferencias.model';
import { AtajosService } from '@core/services/atajos.service';
import { AuthTokenService } from '@core/services/auth-token.service';
import { PreferenciasService } from '@core/services/preferencias.service';
import { CuentaRepository } from '../repositories/cuenta.repository';
import { SesionDeCuentaVM } from '../models/cuenta.vm';

/**
 * Facade de Cuenta — comandos de recuperación de contraseña (públicos), la sesión que muestra "Mi perfil" y las
 * preferencias locales que edita "Preferencias". Expone Observables (los componentes usan `firstValueFrom` para el
 * one-shot). Sin estado propio.
 *
 * Preferencias: viven en `PreferenciasService` y `AtajosService` (`core/services`, por navegador, sin backend) porque
 * también las leen el shell, las listas y los avisos; acá solo se re-exponen para que la pantalla no inyecte servicios
 * de `core/services` (`.claude/rules/componentes-angular.md`).
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

  private readonly preferencias = inject(PreferenciasService);
  private readonly atajos = inject(AtajosService);

  /** Preferencias locales de este navegador. */
  readonly preferencias$: Observable<Preferencias> = this.preferencias.preferencias$;

  /** `true` si todo está como viene de fábrica (incluidos los atajos encendidos): "Restablecer" no tiene qué hacer. */
  readonly preferenciasDeFabrica$: Observable<boolean> = this.preferencias.esDeFabrica$;

  /** Correo que recuerda el login en este navegador (`''` si no hay); se relee al suscribirse. */
  readonly correoRecordado$: Observable<string> = this.preferencias.correoRecordado$;

  /**
   * "Filas por página" en este momento (lectura síncrona): el tamaño inicial de las listas con paginado en servidor
   * (auditoría, feedback), que no van sobre `ListaCliente`.
   */
  get filasPorPagina(): FilasPorPagina {
    return this.preferencias.actual.filasPorPagina;
  }

  /** Preferencia "Atajos de teclado". */
  readonly atajosHabilitados$: Observable<boolean> = this.atajos.habilitados$;

  constructor(
    private cuenta: CuentaRepository,
    private auth: AuthTokenService,
  ) {}

  /** Solicita el email de recuperación (el usuario debe existir y estar activo). */
  requestRecovery(mailTo: string): Observable<MessageDTO> {
    return this.cuenta.requestRecovery(mailTo);
  }

  /** Aplica y guarda al momento los cambios de preferencias (no hay envío). */
  actualizarPreferencias(cambios: Partial<Preferencias>): void {
    this.preferencias.actualizar(cambios);
  }

  /** Vuelve las preferencias y los atajos a fábrica; el correo recordado no se toca. */
  restablecerPreferencias(): void {
    this.preferencias.restablecer();
  }

  setAtajosHabilitados(valor: boolean): void {
    this.atajos.setHabilitados(valor);
  }

  /** Borra el correo que recuerda el login en este navegador. */
  olvidarCorreo(): void {
    this.preferencias.olvidarCorreo();
  }

  /** Cambia la contraseña vía token del enlace. Revoca todas las sesiones del usuario. */
  changePassword(password: string, confirmPassword: string, token: string): Observable<MessageDTO> {
    return this.cuenta.changePassword(password, confirmPassword, token);
  }
}
