import { Injectable } from '@angular/core';
import { Observable, defer, distinctUntilChanged, map } from 'rxjs';
import { UserRole } from '@core/enums/user-role.enum';
import { AuthTokenService } from '@core/services/auth-token.service';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { DashboardHomeVM } from '../models/dashboard.vm';

/**
 * Facade del Home (feature bloqueada por backend; corre en mock). Expone Observables
 * (async pipe; NO signals). Depende solo del repositorio.
 *
 * Excepción documentada: sesión en facades (`.claude/rules/arquitectura-capas.md`). `AuthTokenService` se consulta
 * SOLO para `rolDeSesion$`: el Home arma su matriz de widgets según el rol y la pantalla no inyecta la sesión.
 */
@Injectable({ providedIn: 'root' })
export class DashboardFacade {
  /**
   * Rol canónico de quien mira (`null` sin sesión o sin rol). Reactivo a la sesión; `defer`: la lee al suscribirse.
   * Solo emite cuando el rol cambia: la sesión se vuelve a emitir sin que cambie quién mira (refresco de token)
   * y el Home no tiene por qué recalcular su vista.
   */
  readonly rolDeSesion$: Observable<UserRole | null> = defer(() => this.auth.getCurrentUser$()).pipe(
    map(() => this.auth.getUserRole()),
    distinctUntilChanged(),
  );

  constructor(
    private dashboard: DashboardRepository,
    private auth: AuthTokenService,
  ) {}

  /** Datos de todos los widgets del Home en una sola carga. */
  loadHome(): Observable<DashboardHomeVM> {
    return this.dashboard.getHome();
  }
}
