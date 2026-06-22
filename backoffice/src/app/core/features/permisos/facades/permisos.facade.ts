import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { PermisosRepository } from '../repositories/permisos.repository';
import { PermisoFormValue, PermisoVM } from '../models/permiso.vm';

/**
 * Facade de Permisos (ABM, solo SUPERADMIN). Expone Observables (async pipe; NO signals).
 * Depende solo del repositorio.
 */
@Injectable({ providedIn: 'root' })
export class PermisosFacade {
  private readonly _permisos$ = new BehaviorSubject<PermisoVM[]>([]);
  readonly permisos$ = this._permisos$.asObservable();

  constructor(private permisos: PermisosRepository) {}

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
