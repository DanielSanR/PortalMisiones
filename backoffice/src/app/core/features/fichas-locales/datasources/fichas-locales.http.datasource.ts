import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { sinDialogoGlobal } from '@core/interceptors/http-error.interceptor';
import { FichasLocalesDataSource } from './fichas-locales.datasource';
import { OrganismProcedureLocationExtendedResponseDTO } from '../models/ficha-local.dto';
import { toFichaLocal, toOrganismProcedureLocationRequest } from '../mappers/fichas-locales.mapper';
import { EstadoFicha, FichaLocal, FichaLocalFormValue } from '../models/ficha-local.vm';
import { TransicionBackend } from '../models/workflow';

/**
 * Implementación HTTP real (`/api/organism-procedure-location`, permisos `*_VARIANT` y
 * `PUBLISH_VARIANT`). Completa, pero **NO ACTIVA**: el override `'fichas-locales'` sigue en `'mock'`
 * hasta que el backend cierre G-1.
 *
 * Por qué no se activa: el response real trae solo `{ id, slug, publicationStatus, active,
 * currentVersionNumber }` y el `PUT` es reemplazo total. Sin saber la adopción, la localidad, la URL,
 * los requisitos ni los costos de la ficha, cualquier edición los mandaría vacíos y los BORRARÍA.
 * (Además, el form se niega a editar una ficha con `contenidoCompleto = false`.) El mapper ya tolera
 * el response extendido: cuando G-1 esté, alcanza con quitar el override.
 *
 * - El alcance lo decide el backend (`OrganismScope`): global para SA/MANAGER, el organismo para AO/AGENT.
 * - Nada abre el diálogo global de error (`sinDialogoGlobal()`): cada pantalla traduce el error,
 *   casi siempre un 500 `5000` (G-4), con un texto prudente.
 * - Todos los segmentos interpolados van con `encodeURIComponent`.
 */
@Injectable()
export class FichasLocalesHttpDataSource extends FichasLocalesDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/organism-procedure-location`;
  private readonly publicoUrl = `${environment.apiBaseUrl}/api/procedure`;

  constructor(private http: HttpClient) {
    super();
  }

  list(): Observable<FichaLocal[]> {
    return this.http
      .get<ResponseDTO<OrganismProcedureLocationExtendedResponseDTO[]>>(this.apiUrl, sinDialogoGlobal())
      .pipe(map((res) => (res.data ?? []).map(toFichaLocal)));
  }

  getById(id: string): Observable<FichaLocal> {
    return this.http
      .get<ResponseDTO<OrganismProcedureLocationExtendedResponseDTO>>(this.urlDe(id), sinDialogoGlobal())
      .pipe(map((res) => toFichaLocal(res.data)));
  }

  create(form: FichaLocalFormValue): Observable<FichaLocal> {
    // El backend ignora el estado del POST (siempre BORRADOR), pero la columna es NOT NULL: se manda igual.
    return this.http
      .post<ResponseDTO<OrganismProcedureLocationExtendedResponseDTO>>(
        this.apiUrl, toOrganismProcedureLocationRequest(form, 'BORRADOR'), sinDialogoGlobal(),
      )
      .pipe(map((res) => toFichaLocal(res.data)));
  }

  update(id: string, form: FichaLocalFormValue, estadoActual: EstadoFicha): Observable<FichaLocal> {
    return this.http
      .put<ResponseDTO<OrganismProcedureLocationExtendedResponseDTO>>(
        this.urlDe(id), toOrganismProcedureLocationRequest(form, estadoActual), sinDialogoGlobal(),
      )
      .pipe(map((res) => toFichaLocal(res.data)));
  }

  transicion(id: string, transicion: TransicionBackend): Observable<FichaLocal> {
    return this.http
      .post<ResponseDTO<OrganismProcedureLocationExtendedResponseDTO>>(
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
