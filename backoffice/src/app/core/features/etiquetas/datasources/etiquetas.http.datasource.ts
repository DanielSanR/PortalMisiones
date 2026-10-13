import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { sinDialogoGlobal } from '@core/interceptors/http-error.interceptor';
import { EtiquetasDataSource } from './etiquetas.datasource';
import { TagResponseDTO } from '../models/etiqueta.dto';
import { toEtiquetaVM, toTagRequest } from '../mappers/etiquetas.mapper';
import { EtiquetaFormValue, EtiquetaVM } from '../models/etiqueta.vm';

/**
 * Implementación HTTP real (`/api/tag`, permisos `*_TAG`, PPDT-5.8). El backend aplica el alcance:
 * SUPERADMIN/ADMIN_BACKOFFICE ven todas; ADMIN_ORGANIZATION/AGENT solo las locales de su organismo.
 */
@Injectable()
export class EtiquetasHttpDataSource extends EtiquetasDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/tag`;

  constructor(private http: HttpClient) {
    super();
  }

  list(): Observable<EtiquetaVM[]> {
    return this.http
      .get<ResponseDTO<TagResponseDTO[]>>(this.apiUrl)
      .pipe(map((res) => res.data.map(toEtiquetaVM)));
  }

  getById(id: string): Observable<EtiquetaVM> {
    return this.http
      .get<ResponseDTO<TagResponseDTO>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => toEtiquetaVM(res.data)));
  }

  create(form: EtiquetaFormValue): Observable<EtiquetaVM> {
    return this.http
      .post<ResponseDTO<TagResponseDTO>>(this.apiUrl, toTagRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toEtiquetaVM(res.data)));
  }

  update(id: string, form: EtiquetaFormValue): Observable<EtiquetaVM> {
    return this.http
      .put<ResponseDTO<TagResponseDTO>>(`${this.apiUrl}/${id}`, toTagRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toEtiquetaVM(res.data)));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<ResponseDTO<void>>(`${this.apiUrl}/${id}`, sinDialogoGlobal())
      .pipe(map(() => void 0));
  }
}
