import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { EventosDeVidaDataSource } from './eventos-de-vida.datasource';
import { LifeEventResponseDTO } from '../models/evento-de-vida.dto';
import { toEventoDeVidaVM, toLifeEventRequest } from '../mappers/eventos-de-vida.mapper';
import { EventoDeVidaFormValue, EventoDeVidaVM } from '../models/evento-de-vida.vm';
import { sinDialogoGlobal } from '@core/interceptors/http-error.interceptor';

/** Implementación HTTP real (`/api/life-event`, §5.3). */
@Injectable()
export class EventosDeVidaHttpDataSource extends EventosDeVidaDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/life-event`;

  constructor(private http: HttpClient) {
    super();
  }

  list(): Observable<EventoDeVidaVM[]> {
    return this.http
      .get<ResponseDTO<LifeEventResponseDTO[]>>(this.apiUrl)
      .pipe(map((res) => res.data.map(toEventoDeVidaVM)));
  }

  getById(id: string): Observable<EventoDeVidaVM> {
    return this.http
      .get<ResponseDTO<LifeEventResponseDTO>>(`${this.apiUrl}/${encodeURIComponent(id)}`)
      .pipe(map((res) => toEventoDeVidaVM(res.data)));
  }

  create(form: EventoDeVidaFormValue): Observable<EventoDeVidaVM> {
    return this.http
      .post<ResponseDTO<LifeEventResponseDTO>>(this.apiUrl, toLifeEventRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toEventoDeVidaVM(res.data)));
  }

  update(id: string, form: EventoDeVidaFormValue): Observable<EventoDeVidaVM> {
    return this.http
      .put<ResponseDTO<LifeEventResponseDTO>>(`${this.apiUrl}/${encodeURIComponent(id)}`, toLifeEventRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toEventoDeVidaVM(res.data)));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<ResponseDTO<void>>(`${this.apiUrl}/${encodeURIComponent(id)}`, sinDialogoGlobal())
      .pipe(map(() => void 0));
  }
}
