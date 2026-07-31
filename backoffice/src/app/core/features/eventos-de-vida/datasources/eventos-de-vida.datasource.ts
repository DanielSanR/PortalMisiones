import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { EventoDeVidaFormValue, EventoDeVidaVM } from '../models/evento-de-vida.vm';

/** Fuente de datos de Eventos de Vida. Reads públicos; escrituras SUPERADMIN/ADMIN_BACKOFFICE (§5.3). */
export abstract class EventosDeVidaDataSource {
  abstract list(): Observable<EventoDeVidaVM[]>;
  abstract getById(id: string): Observable<EventoDeVidaVM>;
  abstract create(form: EventoDeVidaFormValue): Observable<EventoDeVidaVM>;
  abstract update(id: string, form: EventoDeVidaFormValue): Observable<EventoDeVidaVM>;
  abstract delete(id: string): Observable<void>;
}

export const EVENTOS_DE_VIDA_DS = new InjectionToken<EventosDeVidaDataSource>('EVENTOS_DE_VIDA_DS');
