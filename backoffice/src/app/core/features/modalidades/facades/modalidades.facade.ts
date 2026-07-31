import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ModalidadesRepository } from '../repositories/modalidades.repository';
import { ModalidadFormValue, ModalidadVM } from '../models/modalidad.vm';

/**
 * Facade de Modalidades. Expone Observables (async pipe; NO signals). Depende solo del repositorio.
 * Mantiene la lista en un BehaviorSubject y la sincroniza tras cada ABM.
 */
@Injectable({ providedIn: 'root' })
export class ModalidadesFacade {
  private readonly _modalidades$ = new BehaviorSubject<ModalidadVM[]>([]);
  readonly modalidades$ = this._modalidades$.asObservable();

  constructor(private repo: ModalidadesRepository) {}

  loadModalidades(): Observable<ModalidadVM[]> {
    return this.repo.list().pipe(tap((list) => this._modalidades$.next(list)));
  }

  getById(id: string): Observable<ModalidadVM> {
    return this.repo.getById(id);
  }

  create(form: ModalidadFormValue): Observable<ModalidadVM> {
    return this.repo.create(form).pipe(
      tap((m) => this._modalidades$.next([...this._modalidades$.value, m]))
    );
  }

  update(id: string, form: ModalidadFormValue): Observable<ModalidadVM> {
    return this.repo.update(id, form).pipe(
      tap((updated) => this._modalidades$.next(this._modalidades$.value.map((m) => (m.id === id ? updated : m))))
    );
  }

  delete(id: string): Observable<void> {
    return this.repo.delete(id).pipe(
      tap(() => this._modalidades$.next(this._modalidades$.value.filter((m) => m.id !== id)))
    );
  }
}
