import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditoriaTramite, AuditoriaFilter } from '../models/dashboard.model';
import { PaginatedResponse } from '../models/tramite.model';

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly apiUrl = `${environment.apiUrl}/auditoria`;

  constructor(private http: HttpClient) {}

  getAll(filter?: AuditoriaFilter): Observable<PaginatedResponse<AuditoriaTramite>> {
    let params = new HttpParams();
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, String(value));
        }
      });
    }
    return this.http.get<PaginatedResponse<AuditoriaTramite>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<AuditoriaTramite> {
    return this.http.get<AuditoriaTramite>(`${this.apiUrl}/${id}`);
  }
}
