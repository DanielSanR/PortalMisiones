import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { TiposOrganismoRepository } from '../repositories/tipos-organismo.repository';
import { TipoOrganismoFormValue, TipoOrganismoVM } from '../models/tipo-organismo.vm';

/**
 * Facade de Tipos de Organismo. Expone Observables (async pipe; NO signals). Depende solo del repositorio.
 * Mantiene la lista en un BehaviorSubject y la sincroniza tras cada ABM.
 */
@Injectable({ providedIn: 'root' })
export class TiposOrganismoFacade {
  private readonly _tipos$ = new BehaviorSubject<TipoOrganismoVM[]>([]);
  readonly tipos$ = this._tipos$.asObservable();

  constructor(private repo: TiposOrganismoRepository) {}

  loadTipos(): Observable<TipoOrganismoVM[]> {
    return this.repo.list().pipe(tap((list) => this._tipos$.next(list)));
  }

  getById(id: string): Observable<TipoOrganismoVM> {
    return this.repo.getById(id);
  }

  create(form: TipoOrganismoFormValue): Observable<TipoOrganismoVM> {
    return this.repo.create(form).pipe(
      tap((t) => this._tipos$.next([...this._tipos$.value, t]))
    );
  }

  update(id: string, form: TipoOrganismoFormValue): Observable<TipoOrganismoVM> {
    return this.repo.update(id, form).pipe(
      tap((updated) => this._tipos$.next(this._tipos$.value.map((t) => (t.id === id ? updated : t))))
    );
  }

  delete(id: string): Observable<void> {
    return this.repo.delete(id).pipe(
      tap(() => this._tipos$.next(this._tipos$.value.filter((t) => t.id !== id)))
    );
  }
}
