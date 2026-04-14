import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Tramite,
  TramiteCreate,
  TramiteUpdate,
  TramiteFilter,
  PaginatedResponse,
  Modalidad,
  Etiqueta,
  TramiteContenidoLocalidad,
  TramiteContenidoLocalidadCreate,
  TramiteContenidoLocalidadUpdate,
} from '../models/tramite.model';
import { SKIP_ERROR_INTERCEPTOR } from '../interceptors/http-error.interceptor';

@Injectable({ providedIn: 'root' })
export class TramiteService {
  private readonly apiUrl = `${environment.apiUrl}/tramites`;

  constructor(private http: HttpClient) {}

  getAll(filter?: TramiteFilter, options?: { skipInterceptor?: boolean }): Observable<PaginatedResponse<Tramite>> {
    let params = new HttpParams();
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, String(value));
        }
      });
    }

    const context = options?.skipInterceptor
      ? new HttpContext().set(SKIP_ERROR_INTERCEPTOR, true)
      : new HttpContext();

    return this.http.get<PaginatedResponse<Tramite>>(this.apiUrl, { params, context });
  }

  getById(id: string): Observable<Tramite> {
    return this.http.get<Tramite>(`${this.apiUrl}/${id}`);
  }

  getBySlug(slug: string): Observable<Tramite> {
    return this.http.get<Tramite>(`${this.apiUrl}/slug/${slug}`);
  }

  create(data: TramiteCreate): Observable<Tramite> {
    return this.http.post<Tramite>(this.apiUrl, data);
  }

  update(id: string, data: TramiteUpdate): Observable<Tramite> {
    return this.http.put<Tramite>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  publish(id: string): Observable<Tramite> {
    return this.http.patch<Tramite>(`${this.apiUrl}/${id}/publicar`, {});
  }

  unpublish(id: string): Observable<Tramite> {
    return this.http.patch<Tramite>(`${this.apiUrl}/${id}/despublicar`, {});
  }

  sendToReview(id: string): Observable<Tramite> {
    return this.http.patch<Tramite>(`${this.apiUrl}/${id}/revision`, {});
  }

  private modalidades$ = this.http.get<PaginatedResponse<Modalidad>>(
    `${environment.apiUrl}/modalidades`
  ).pipe(
    map(response => response.data),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private etiquetas$ = this.http.get<PaginatedResponse<Etiqueta>>(
    `${environment.apiUrl}/etiquetas`
  ).pipe(
    map(response => response.data),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  getModalidades(): Observable<Modalidad[]> {
    return this.modalidades$;
  }

  getEtiquetas(): Observable<Etiqueta[]> {
    return this.etiquetas$;
  }

  // ── Contenido por localidad ──────────────────────────────

  getContenidoLocalidades(tramiteId: string): Observable<TramiteContenidoLocalidad[]> {
    return this.http.get<TramiteContenidoLocalidad[]>(`${this.apiUrl}/${tramiteId}/localidades`);
  }

  getContenidoLocalidad(tramiteId: string, localidadId: number): Observable<TramiteContenidoLocalidad> {
    return this.http.get<TramiteContenidoLocalidad>(`${this.apiUrl}/${tramiteId}/localidades/${localidadId}`);
  }

  addContenidoLocalidad(tramiteId: string, data: TramiteContenidoLocalidadCreate): Observable<TramiteContenidoLocalidad> {
    return this.http.post<TramiteContenidoLocalidad>(`${this.apiUrl}/${tramiteId}/localidades`, data);
  }

  updateContenidoLocalidad(tramiteId: string, localidadId: number, data: TramiteContenidoLocalidadUpdate): Observable<TramiteContenidoLocalidad> {
    return this.http.put<TramiteContenidoLocalidad>(`${this.apiUrl}/${tramiteId}/localidades/${localidadId}`, data);
  }

  removeContenidoLocalidad(tramiteId: string, localidadId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${tramiteId}/localidades/${localidadId}`);
  }
}
