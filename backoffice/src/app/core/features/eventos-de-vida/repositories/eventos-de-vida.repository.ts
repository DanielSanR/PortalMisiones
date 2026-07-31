import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { EVENTOS_DE_VIDA_DS, EventosDeVidaDataSource } from '../datasources/eventos-de-vida.datasource';
import { EventoDeVidaFormValue, EventoDeVidaVM } from '../models/evento-de-vida.vm';

/** Repositorio de Eventos de Vida. Inyecta el DataSource vía token. */
@Injectable({ providedIn: 'root' })
export class EventosDeVidaRepository {
  constructor(@Inject(EVENTOS_DE_VIDA_DS) private ds: EventosDeVidaDataSource) {}

  list(): Observable<EventoDeVidaVM[]> {
    return this.ds.list();
  }

  getById(id: string): Observable<EventoDeVidaVM> {
    return this.ds.getById(id);
  }

  create(form: EventoDeVidaFormValue): Observable<EventoDeVidaVM> {
    return this.ds.create(form);
  }

  update(id: string, form: EventoDeVidaFormValue): Observable<EventoDeVidaVM> {
    return this.ds.update(id, form);
  }

  delete(id: string): Observable<void> {
    return this.ds.delete(id);
  }
}
