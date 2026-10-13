import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { sinDialogoGlobal } from '@core/interceptors/http-error.interceptor';
import { PuntosAtencionDataSource } from './puntos-atencion.datasource';
import { AttentionPointResponseDTO } from '../models/punto-atencion.dto';
import { toAttentionPointRequest, toPuntoAtencionVM } from '../mappers/puntos-atencion.mapper';
import { PuntoAtencionFormValue, PuntoAtencionVM } from '../models/punto-atencion.vm';

/**
 * Implementación HTTP real (`/api/attention-point`, permisos `*_ATTENTION_POINT`). Completa, pero el
 * override `'puntos-atencion'` sigue en `'mock'`: los puntos cuelgan de fichas, y las fichas siguen en
 * mock hasta G-1. Se activan juntos para no mezclar ids reales con ids mock (PLAN_TRAMITES_API.md §8).
 * Además, R-3: `V2.23` probablemente no asignó `*_ATTENTION_POINT` a ningún rol (403).
 *
 * Nada abre el diálogo global de error: el panel muestra su propio error con "Reintentar" y el diálogo
 * de alta/edición traduce `4012`/`4073`. Segmentos interpolados con `encodeURIComponent`.
 */
@Injectable()
export class PuntosAtencionHttpDataSource extends PuntosAtencionDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/attention-point`;

  constructor(private http: HttpClient) {
    super();
  }

  list(): Observable<PuntoAtencionVM[]> {
    return this.http
      .get<ResponseDTO<AttentionPointResponseDTO[]>>(this.apiUrl, sinDialogoGlobal())
      .pipe(map((res) => (res.data ?? []).map(toPuntoAtencionVM)));
  }

  getById(id: string): Observable<PuntoAtencionVM> {
    return this.http
      .get<ResponseDTO<AttentionPointResponseDTO>>(`${this.apiUrl}/${encodeURIComponent(id)}`, sinDialogoGlobal())
      .pipe(map((res) => toPuntoAtencionVM(res.data)));
  }

  create(form: PuntoAtencionFormValue): Observable<PuntoAtencionVM> {
    return this.http
      .post<ResponseDTO<AttentionPointResponseDTO>>(this.apiUrl, toAttentionPointRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toPuntoAtencionVM(res.data)));
  }

  update(id: string, form: PuntoAtencionFormValue): Observable<PuntoAtencionVM> {
    return this.http
      .put<ResponseDTO<AttentionPointResponseDTO>>(
        `${this.apiUrl}/${encodeURIComponent(id)}`, toAttentionPointRequest(form), sinDialogoGlobal(),
      )
      .pipe(map((res) => toPuntoAtencionVM(res.data)));
  }

  desactivar(id: string): Observable<void> {
    return this.http
      .delete<ResponseDTO<void>>(`${this.apiUrl}/${encodeURIComponent(id)}`, sinDialogoGlobal())
      .pipe(map(() => void 0));
  }
}
