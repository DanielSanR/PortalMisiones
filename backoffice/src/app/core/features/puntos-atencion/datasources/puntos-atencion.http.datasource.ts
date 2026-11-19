import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { sinDialogoGlobal } from '@core/interceptors/http-error.interceptor';
import { PuntosAtencionDataSource } from './puntos-atencion.datasource';
import { AttentionPointResponseDTO, PuntosAtencionFiltro } from '../models/punto-atencion.dto';
import { toAttentionPointRequest, toPuntoAtencionVM } from '../mappers/puntos-atencion.mapper';
import { PuntoAtencionFormValue, PuntoAtencionVM } from '../models/punto-atencion.vm';

/**
 * Implementación HTTP real (`/api/attention-point`, permisos `*_ATTENTION_POINT`), contra el backend `dev` @
 * `586b670`. Va con la misma fuente que `'fichas-locales'`: los puntos cuelgan de fichas, y mezclar ids reales
 * con ids mock no funciona (PLAN_TRAMITES_API.md §8).
 *
 * Nada abre el diálogo global de error: el panel muestra su propio error con "Reintentar" y el diálogo
 * de alta/edición traduce `4012`/`4073`. Segmentos interpolados con `encodeURIComponent`.
 */
@Injectable()
export class PuntosAtencionHttpDataSource extends PuntosAtencionDataSource {
  readonly fuenteSimulada = false;
  private readonly apiUrl = `${environment.apiBaseUrl}/api/attention-point`;

  constructor(private http: HttpClient) {
    super();
  }

  list(filtro?: PuntosAtencionFiltro): Observable<PuntoAtencionVM[]> {
    // Con el filtro el backend devuelve solo los activos de la ficha; sin él, todo el alcance.
    const params = filtro?.fichaId
      ? new HttpParams().set('organismProcedureLocationId', filtro.fichaId)
      : undefined;
    return this.http
      .get<ResponseDTO<AttentionPointResponseDTO[]>>(this.apiUrl, { ...sinDialogoGlobal(), params })
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
