import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, defer, forkJoin, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { ESCRIBIR_ROLES_PERMISOS_ACCESS } from '@core/constants/policy-overrides.constants';
import { AuthTokenService } from '@core/services/auth-token.service';
import { PermisosRepository } from '@features/permisos';
import { RolesRepository } from '../repositories/roles.repository';
import { RolFormData, RolFormValue, RolVM } from '../models/role.vm';

/**
 * Facade de Roles (ABM, solo SUPERADMIN). Expone Observables (async pipe; NO signals).
 * Orquesta con permisos (vía su Repository) para el selector del formulario.
 *
 * Excepción documentada: sesión en facades (`.claude/rules/arquitectura-capas.md`). `AuthTokenService` se consulta
 * SOLO para `puedeEscribir$`: `/api/role` se autoriza por ROL (leer SA/AB, escribir solo SA — PPDT-5.1) y no por
 * permiso atómico, así que la pantalla no puede resolverlo con `*appHasPermission` y tampoco inyecta la sesión.
 */
@Injectable({ providedIn: 'root' })
export class RolesFacade {
  private readonly _roles$ = new BehaviorSubject<RolVM[]>([]);
  readonly roles$ = this._roles$.asObservable();

  // Datos de REFERENCIA cacheados: roles asignables (para selects de creación de usuarios).
  private readonly reloadAllowed$ = new BehaviorSubject<void>(undefined);
  readonly allowedRoles$: Observable<RolVM[]> = this.reloadAllowed$.pipe(
    switchMap(() => this.roles.listAllowed()),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  /**
   * ¿Quien mira puede crear/editar/eliminar roles? Misma regla que la ruta de edición
   * (`ESCRIBIR_ROLES_PERMISOS_ACCESS`). Reactivo a la sesión; `defer`: la lee al suscribirse.
   */
  readonly puedeEscribir$: Observable<boolean> = defer(() => this.auth.getCurrentUser$()).pipe(
    map(() => this.auth.canAccess(ESCRIBIR_ROLES_PERMISOS_ACCESS)),
  );

  constructor(
    private roles: RolesRepository,
    private permisos: PermisosRepository,
    private auth: AuthTokenService,
  ) {}

  /** Invalida la caché de roles asignables (tras ABM de roles). */
  reloadAllowed(): void {
    this.reloadAllowed$.next();
  }

  loadRoles(): Observable<RolVM[]> {
    return this.roles.list().pipe(tap((list) => this._roles$.next(list)));
  }

  /** Roles asignables (para selects de creación de usuarios). */
  listAllowed(): Observable<RolVM[]> {
    return this.roles.listAllowed();
  }

  /** Resuelve el formulario en una sola llamada: permisos disponibles + rol en edición. */
  getFormData(id: string | null): Observable<RolFormData> {
    return forkJoin({
      permisos: this.permisos.list(),
      rol: id ? this.roles.getById(id) : of(null),
    });
  }

  create(form: RolFormValue): Observable<RolVM> {
    return this.roles.create(form).pipe(
      tap((r) => {
        this._roles$.next([...this._roles$.value, r]);
        this.reloadAllowed();
      })
    );
  }

  update(id: string, form: RolFormValue): Observable<RolVM> {
    return this.roles.update(id, form).pipe(
      tap((updated) => {
        this._roles$.next(this._roles$.value.map((r) => (r.id === id ? updated : r)));
        this.reloadAllowed();
      })
    );
  }

  /** Baja lógica (`RoleService.deleteRole` desactiva): el rol sigue en la lista, como inactivo. */
  delete(id: string): Observable<void> {
    return this.roles.delete(id).pipe(
      tap(() => {
        this._roles$.next(this._roles$.value.map((r) => (r.id === id ? { ...r, activo: false } : r)));
        this.reloadAllowed();
      })
    );
  }

  /**
   * Reactiva un rol dado de baja. El backend lo hace con un `PUT` que reemplaza TODO el rol y no tiene versión:
   * con la fila de una lista abierta hace rato se revertirían los cambios que otro administrador hizo mientras
   * tanto (permisos, descripción). Por eso pide el rol fresco (`GET`) y reactiva ESO; si el `GET` falla, no hay
   * `PUT`. La fila se actualiza con lo que devuelve el backend.
   */
  activate(id: string): Observable<RolVM> {
    return this.roles.getById(id).pipe(
      switchMap((actual) => this.roles.activate(actual)),
      tap((activado) => {
        this._roles$.next(this._roles$.value.map((r) => (r.id === id ? activado : r)));
        this.reloadAllowed();
      })
    );
  }
}
