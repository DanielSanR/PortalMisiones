import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { DestinatariosRepository } from '../repositories/destinatarios.repository';
import { DestinatarioFormValue, DestinatarioVM } from '../models/destinatario.vm';

/**
 * Facade de Destinatarios. Expone Observables (async pipe; NO signals). Depende solo del repositorio.
 * Mantiene la lista en un BehaviorSubject y la sincroniza tras cada ABM.
 */
@Injectable({ providedIn: 'root' })
export class DestinatariosFacade {
  private readonly _destinatarios$ = new BehaviorSubject<DestinatarioVM[]>([]);
  readonly destinatarios$ = this._destinatarios$.asObservable();

  constructor(private repo: DestinatariosRepository) {}

  loadDestinatarios(): Observable<DestinatarioVM[]> {
    return this.repo.list().pipe(tap((list) => this._destinatarios$.next(list)));
  }

  getById(id: string): Observable<DestinatarioVM> {
    return this.repo.getById(id);
  }

  create(form: DestinatarioFormValue): Observable<DestinatarioVM> {
    return this.repo.create(form).pipe(
      tap((d) => this._destinatarios$.next([...this._destinatarios$.value, d]))
    );
  }

  update(id: string, form: DestinatarioFormValue): Observable<DestinatarioVM> {
    return this.repo.update(id, form).pipe(
      tap((updated) => this._destinatarios$.next(this._destinatarios$.value.map((d) => (d.id === id ? updated : d))))
    );
  }

  delete(id: string): Observable<void> {
    return this.repo.delete(id).pipe(
      tap(() => this._destinatarios$.next(this._destinatarios$.value.filter((d) => d.id !== id)))
    );
  }
}
