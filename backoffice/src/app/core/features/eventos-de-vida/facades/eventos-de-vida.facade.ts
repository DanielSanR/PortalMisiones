import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { EventosDeVidaRepository } from '../repositories/eventos-de-vida.repository';
import { EventoDeVidaFormValue, EventoDeVidaVM } from '../models/evento-de-vida.vm';

/**
 * Facade de Eventos de Vida. Expone Observables (async pipe; NO signals). Depende solo del repositorio.
 * Mantiene la lista en un BehaviorSubject y la sincroniza tras cada ABM.
 */
@Injectable({ providedIn: 'root' })
export class EventosDeVidaFacade {
  private readonly _eventos$ = new BehaviorSubject<EventoDeVidaVM[]>([]);
  readonly eventos$ = this._eventos$.asObservable();

  constructor(private repo: EventosDeVidaRepository) {}

  loadEventos(): Observable<EventoDeVidaVM[]> {
    return this.repo.list().pipe(tap((list) => this._eventos$.next(list)));
  }

  getById(id: string): Observable<EventoDeVidaVM> {
    return this.repo.getById(id);
  }

  create(form: EventoDeVidaFormValue): Observable<EventoDeVidaVM> {
    return this.repo.create(form).pipe(
      tap((e) => this._eventos$.next([...this._eventos$.value, e]))
    );
  }

  update(id: string, form: EventoDeVidaFormValue): Observable<EventoDeVidaVM> {
    return this.repo.update(id, form).pipe(
      tap((updated) => this._eventos$.next(this._eventos$.value.map((e) => (e.id === id ? updated : e))))
    );
  }

  delete(id: string): Observable<void> {
    return this.repo.delete(id).pipe(
      tap(() => this._eventos$.next(this._eventos$.value.filter((e) => e.id !== id)))
    );
  }
}
