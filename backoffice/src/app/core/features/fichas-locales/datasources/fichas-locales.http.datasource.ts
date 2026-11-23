import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { sinDialogoGlobal } from '@core/interceptors/http-error.interceptor';
import { FichasLocalesDataSource } from './fichas-locales.datasource';
import { FichasLocalesFiltro, OrganismProcedureLocationResponseDTO } from '../models/ficha-local.dto';
import { toFichaLocal, toOrganismProcedureLocationRequest } from '../mappers/fichas-locales.mapper';
import { FichaLocal, FichaLocalFormValue } from '../models/ficha-local.vm';
import { TransicionBackend } from '../domain/workflow';

/**
 * Implementación HTTP real (`/api/organism-procedure-location`, permisos `*_VARIANT` y
 * `PUBLISH_VARIANT`), contra el backend `dev` @ `586b670`.
 *
 * - El response trae la ficha completa (adopción, localidad, URL, requisitos, costos): lo leído con un
 *   `GET` es base suficiente para el `PUT`, que es reemplazo total.
 * - El alcance lo decide el backend (`OrganismScope`): global para SA/MANAGER, el organismo para AO/AGENT.
 * - Nada abre el diálogo global de error (`sinDialogoGlobal()`): cada pantalla traduce el error
 *   (`4012`, `4073`, `4077`, `4091`, y el 500 `5000` de los duplicados) con un texto propio.
 * - Todos los segmentos interpolados van con `encodeURIComponent`.
 */
@Injectable()
export class FichasLocalesHttpDataSource extends FichasLocalesDataSource {
  readonly fuenteSimulada = false;
  private readonly apiUrl = `${environment.apiBaseUrl}/api/organism-procedure-location`;
  private readonly publicoUrl = `${environment.apiBaseUrl}/api/procedure`;

  constructor(private http: HttpClient) {
    super();
  }

  list(filtro?: FichasLocalesFiltro): Observable<FichaLocal[]> {
    // El filtro es opcional: sin él, el backend devuelve todo el alcance.
    const params = filtro?.adopcionId
      ? new HttpParams().set('organismProcedureId', filtro.adopcionId)
      : undefined;
    return this.http
      .get<ResponseDTO<OrganismProcedureLocationResponseDTO[]>>(this.apiUrl, { ...sinDialogoGlobal(), params })
      .pipe(map((res) => (res.data ?? []).map(toFichaLocal)));
  }

  getById(id: string): Observable<FichaLocal> {
    return this.http
      .get<ResponseDTO<OrganismProcedureLocationResponseDTO>>(this.urlDe(id), sinDialogoGlobal())
      .pipe(map((res) => toFichaLocal(res.data)));
  }

  create(form: FichaLocalFormValue): Observable<FichaLocal> {
    return this.http
      .post<ResponseDTO<OrganismProcedureLocationResponseDTO>>(
        this.apiUrl, toOrganismProcedureLocationRequest(form), sinDialogoGlobal(),
      )
      .pipe(map((res) => toFichaLocal(res.data)));
  }

  update(id: string, form: FichaLocalFormValue): Observable<FichaLocal> {
    return this.http
      .put<ResponseDTO<OrganismProcedureLocationResponseDTO>>(
        this.urlDe(id), toOrganismProcedureLocationRequest(form), sinDialogoGlobal(),
      )
      .pipe(map((res) => toFichaLocal(res.data)));
  }

  transicion(id: string, transicion: TransicionBackend): Observable<FichaLocal> {
    return this.http
      .post<ResponseDTO<OrganismProcedureLocationResponseDTO>>(
        `${this.urlDe(id)}/${encodeURIComponent(transicion)}`, null, sinDialogoGlobal(),
      )
      .pipe(map((res) => toFichaLocal(res.data)));
  }

  desactivar(id: string): Observable<void> {
    return this.http
      .delete<ResponseDTO<void>>(this.urlDe(id), sinDialogoGlobal())
      .pipe(map(() => void 0));
  }

  /** Endpoint público con la ficha publicada completa (nombres y puntos de atención incluidos). */
  urlPublica(slug: string): string | null {
    return `${this.publicoUrl}/${encodeURIComponent(slug)}`;
  }

  private urlDe(id: string): string {
    return `${this.apiUrl}/${encodeURIComponent(id)}`;
  }
}
