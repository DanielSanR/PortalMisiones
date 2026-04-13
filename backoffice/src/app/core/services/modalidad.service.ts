import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Modalidad, ModalidadCreate, ModalidadUpdate, PaginatedResponse } from '../models/tramite.model';

@Injectable({ providedIn: 'root' })
export class ModalidadService {
  private readonly apiUrl = `${environment.apiUrl}/modalidades`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<PaginatedResponse<Modalidad>> {
    return this.http.get<PaginatedResponse<Modalidad>>(this.apiUrl);
  }

  getById(id: number): Observable<Modalidad> {
    return this.http.get<Modalidad>(`${this.apiUrl}/${id}`);
  }

  create(data: ModalidadCreate): Observable<Modalidad> {
    return this.http.post<Modalidad>(this.apiUrl, data);
  }

  update(id: number, data: ModalidadUpdate): Observable<Modalidad> {
    return this.http.put<Modalidad>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
