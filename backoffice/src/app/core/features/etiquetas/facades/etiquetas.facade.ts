import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { EtiquetasRepository } from '../repositories/etiquetas.repository';
import { EtiquetaFormValue, EtiquetaVM } from '../models/etiqueta.vm';

/**
 * Facade de Etiquetas (feature bloqueada por backend; corre en mock). Expone Observables
 * (async pipe; NO signals). Depende solo del repositorio.
 */
@Injectable({ providedIn: 'root' })
export class EtiquetasFacade {
  private readonly _etiquetas$ = new BehaviorSubject<EtiquetaVM[]>([]);
  readonly etiquetas$ = this._etiquetas$.asObservable();

  constructor(private etiquetas: EtiquetasRepository) {}

  loadEtiquetas(): Observable<EtiquetaVM[]> {
    return this.etiquetas.list().pipe(tap((list) => this._etiquetas$.next(list)));
  }

  getById(id: number): Observable<EtiquetaVM> {
    return this.etiquetas.getById(id);
  }

  create(form: EtiquetaFormValue): Observable<EtiquetaVM> {
    return this.etiquetas.create(form).pipe(tap((e) => this._etiquetas$.next([...this._etiquetas$.value, e])));
  }

  update(id: number, form: EtiquetaFormValue): Observable<EtiquetaVM> {
    return this.etiquetas.update(id, form).pipe(
      tap((updated) => this._etiquetas$.next(this._etiquetas$.value.map((e) => (e.id === id ? updated : e))))
    );
  }

  delete(id: number): Observable<void> {
    return this.etiquetas.delete(id).pipe(
      tap(() => this._etiquetas$.next(this._etiquetas$.value.filter((e) => e.id !== id)))
    );
  }
}
