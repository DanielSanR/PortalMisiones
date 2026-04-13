import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Etiqueta, EtiquetaCreate, EtiquetaUpdate, PaginatedResponse } from '../models/tramite.model';

@Injectable({ providedIn: 'root' })
export class EtiquetaService {
  private readonly apiUrl = `${environment.apiUrl}/etiquetas`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<PaginatedResponse<Etiqueta>> {
    return this.http.get<PaginatedResponse<Etiqueta>>(this.apiUrl);
  }

  getById(id: number): Observable<Etiqueta> {
    return this.http.get<Etiqueta>(`${this.apiUrl}/${id}`);
  }

  create(data: EtiquetaCreate): Observable<Etiqueta> {
    return this.http.post<Etiqueta>(this.apiUrl, data);
  }

  update(id: number, data: EtiquetaUpdate): Observable<Etiqueta> {
    return this.http.put<Etiqueta>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
