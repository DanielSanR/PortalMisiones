import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardMetrics, TopTramite, TopBusqueda, AuditoriaTramite } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly apiUrl = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  getMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.apiUrl}/metrics`);
  }

  getTopTramites(limit = 10): Observable<TopTramite[]> {
    return this.http.get<TopTramite[]>(`${this.apiUrl}/top-tramites`, {
      params: { limit: String(limit) },
    });
  }

  getTopBusquedas(limit = 10): Observable<TopBusqueda[]> {
    return this.http.get<TopBusqueda[]>(`${this.apiUrl}/top-busquedas`, {
      params: { limit: String(limit) },
    });
  }

  getAuditoria(page = 1, pageSize = 20): Observable<AuditoriaTramite[]> {
    return this.http.get<AuditoriaTramite[]>(`${this.apiUrl}/auditoria`, {
      params: { page: String(page), pageSize: String(pageSize) },
    });
  }
}
