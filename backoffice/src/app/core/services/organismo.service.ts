import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Organismo, OrganismoCreate, PaginatedResponse } from '../models/tramite.model';

@Injectable({ providedIn: 'root' })
export class OrganismoService {
  private readonly apiUrl = `${environment.apiUrl}/organismos`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<PaginatedResponse<Organismo>> {
    return this.http.get<PaginatedResponse<Organismo>>(this.apiUrl);
  }

  getById(id: string): Observable<Organismo> {
    return this.http.get<Organismo>(`${this.apiUrl}/${id}`);
  }

  create(data: OrganismoCreate): Observable<Organismo> {
    return this.http.post<Organismo>(this.apiUrl, data);
  }

  update(id: string, data: Partial<OrganismoCreate>): Observable<Organismo> {
    return this.http.put<Organismo>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
