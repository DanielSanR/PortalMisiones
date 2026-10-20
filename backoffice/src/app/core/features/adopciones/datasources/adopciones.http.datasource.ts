import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { sinDialogoGlobal } from '@core/interceptors/http-error.interceptor';
import { AdopcionesDataSource } from './adopciones.datasource';
import { OrganismProcedureResponseDTO } from '../models/adopcion.dto';
import { toAdopcion, toOrganismProcedureRequest } from '../mappers/adopciones.mapper';
import { Adopcion, AdopcionFormValue } from '../models/adopcion.vm';

/**
 * Implementación HTTP real (`/api/organism-procedure`, permisos `*_ADOPTION`). El alcance lo decide el
 * backend (`OrganismScope`): global para SA/AB, el propio organismo para AO. Nada abre el diálogo
 * global de error: el diálogo "Adoptar" y el detalle traducen `4080`/`4073`/`4012` en su banner, y
 * lista y detalle muestran su propio estado de error con "Reintentar".
 */
@Injectable()
export class AdopcionesHttpDataSource extends AdopcionesDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/organism-procedure`;

  constructor(private http: HttpClient) {
    super();
  }

  list(): Observable<Adopcion[]> {
    return this.http
      .get<ResponseDTO<OrganismProcedureResponseDTO[]>>(this.apiUrl, sinDialogoGlobal())
      .pipe(map((res) => (res.data ?? []).map(toAdopcion)));
  }

  getById(id: string): Observable<Adopcion> {
    return this.http
      .get<ResponseDTO<OrganismProcedureResponseDTO>>(`${this.apiUrl}/${encodeURIComponent(id)}`, sinDialogoGlobal())
      .pipe(map((res) => toAdopcion(res.data)));
  }

  create(form: AdopcionFormValue): Observable<Adopcion> {
    return this.http
      .post<ResponseDTO<OrganismProcedureResponseDTO>>(this.apiUrl, toOrganismProcedureRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toAdopcion(res.data)));
  }

  update(id: string, form: AdopcionFormValue): Observable<Adopcion> {
    return this.http
      .put<ResponseDTO<OrganismProcedureResponseDTO>>(
        `${this.apiUrl}/${encodeURIComponent(id)}`, toOrganismProcedureRequest(form), sinDialogoGlobal(),
      )
      .pipe(map((res) => toAdopcion(res.data)));
  }

  deshabilitar(id: string): Observable<void> {
    return this.http
      .delete<ResponseDTO<void>>(`${this.apiUrl}/${encodeURIComponent(id)}`, sinDialogoGlobal())
      .pipe(map(() => void 0));
  }
}
