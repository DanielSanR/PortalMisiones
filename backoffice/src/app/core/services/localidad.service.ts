import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Localidad, PaginatedResponse } from '../models/tramite.model';

@Injectable({ providedIn: 'root' })
export class LocalidadService {
  private readonly apiUrl = `${environment.apiUrl}/localidades`;

  constructor(private http: HttpClient) {}

  getAll(search?: string, departamento?: string): Observable<PaginatedResponse<Localidad>> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (departamento) params = params.set('departamento', departamento);
    return this.http.get<PaginatedResponse<Localidad>>(this.apiUrl, { params });
  }
}
