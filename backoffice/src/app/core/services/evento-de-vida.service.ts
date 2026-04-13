import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EventoDeVida, EventoDeVidaCreate, EventoDeVidaUpdate, PaginatedResponse } from '../models/tramite.model';

@Injectable({ providedIn: 'root' })
export class EventoDeVidaService {
  private readonly apiUrl = `${environment.apiUrl}/eventos-de-vida`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<PaginatedResponse<EventoDeVida>> {
    return this.http.get<PaginatedResponse<EventoDeVida>>(this.apiUrl);
  }

  getById(id: number): Observable<EventoDeVida> {
    return this.http.get<EventoDeVida>(`${this.apiUrl}/${id}`);
  }

  create(data: EventoDeVidaCreate): Observable<EventoDeVida> {
    return this.http.post<EventoDeVida>(this.apiUrl, data);
  }

  update(id: number, data: EventoDeVidaUpdate): Observable<EventoDeVida> {
    return this.http.put<EventoDeVida>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  toggleActive(id: number): Observable<EventoDeVida> {
    return this.http.patch<EventoDeVida>(`${this.apiUrl}/${id}/toggle-active`, {});
  }
}
