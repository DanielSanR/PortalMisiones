import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin, of, shareReplay, switchMap, tap } from 'rxjs';
import { PermisosRepository } from '@features/permisos';
import { RolesRepository } from '../repositories/roles.repository';
import { RolFormData, RolFormValue, RolVM } from '../models/role.vm';

/**
 * Facade de Roles (ABM, solo SUPERADMIN). Expone Observables (async pipe; NO signals).
 * Orquesta con permisos (vía su Repository) para el selector del formulario.
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

  constructor(
    private roles: RolesRepository,
    private permisos: PermisosRepository
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

  delete(id: string): Observable<void> {
    return this.roles.delete(id).pipe(
      tap(() => {
        this._roles$.next(this._roles$.value.filter((r) => r.id !== id));
        this.reloadAllowed();
      })
    );
  }
}
