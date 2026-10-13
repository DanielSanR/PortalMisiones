import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FeedbackTramite, FeedbackFilter } from '../models/dashboard.model';
import { PaginatedResponse } from '../models/tramite.model';

/**
 * Service legacy de feedback: lo usa solo `tramites` (resumen de valoraciones de la ficha, vía
 * `TramitesMockDataSource`). La pantalla de Feedback va por `@features/feedback` (mock propio).
 */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly apiUrl = `${environment.apiUrl}/feedback`;

  constructor(private http: HttpClient) {}

  getAll(filter?: FeedbackFilter): Observable<PaginatedResponse<FeedbackTramite>> {
    let params = new HttpParams();
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, String(value));
        }
      });
    }
    return this.http.get<PaginatedResponse<FeedbackTramite>>(this.apiUrl, { params });
  }
}
