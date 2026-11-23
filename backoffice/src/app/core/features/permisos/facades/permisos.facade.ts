import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, defer, map, tap } from 'rxjs';
import { ESCRIBIR_ROLES_PERMISOS_ACCESS } from '@core/constants/policy-overrides.constants';
import { AuthTokenService } from '@core/services/auth-token.service';
import { PermisosRepository } from '../repositories/permisos.repository';
import { PermisoFormValue, PermisoVM } from '../models/permiso.vm';

/**
 * Facade de Permisos (ABM, solo SUPERADMIN). Expone Observables (async pipe; NO signals).
 * Depende solo del repositorio.
 *
 * Excepción documentada: sesión en facades (`.claude/rules/arquitectura-capas.md`). `AuthTokenService` se consulta
 * SOLO para `puedeEscribir$`: `/api/permission` se autoriza por ROL y no por permiso atómico, así que la pantalla
 * no puede resolverlo con `*appHasPermission` y tampoco inyecta la sesión.
 */
@Injectable({ providedIn: 'root' })
export class PermisosFacade {
  private readonly _permisos$ = new BehaviorSubject<PermisoVM[]>([]);
  readonly permisos$ = this._permisos$.asObservable();

  /**
   * ¿Quien mira puede crear/editar/eliminar permisos? Misma regla que la ruta (`ESCRIBIR_ROLES_PERMISOS_ACCESS`:
   * solo SUPERADMIN, PPDT-5.1). Reactivo a la sesión; `defer`: la lee al suscribirse.
   */
  readonly puedeEscribir$: Observable<boolean> = defer(() => this.auth.getCurrentUser$()).pipe(
    map(() => this.auth.canAccess(ESCRIBIR_ROLES_PERMISOS_ACCESS)),
  );

  constructor(
    private permisos: PermisosRepository,
    private auth: AuthTokenService,
  ) {}

  loadPermisos(): Observable<PermisoVM[]> {
    return this.permisos.list().pipe(tap((list) => this._permisos$.next(list)));
  }

  getById(id: string): Observable<PermisoVM> {
    return this.permisos.getById(id);
  }

  create(form: PermisoFormValue): Observable<PermisoVM> {
    return this.permisos.create(form).pipe(tap((p) => this._permisos$.next([...this._permisos$.value, p])));
  }

  update(id: string, form: PermisoFormValue): Observable<PermisoVM> {
    return this.permisos.update(id, form).pipe(
      tap((updated) => this._permisos$.next(this._permisos$.value.map((p) => (p.id === id ? updated : p))))
    );
  }

  delete(id: string): Observable<void> {
    return this.permisos.delete(id).pipe(
      tap(() => this._permisos$.next(this._permisos$.value.filter((p) => p.id !== id)))
    );
  }
}
