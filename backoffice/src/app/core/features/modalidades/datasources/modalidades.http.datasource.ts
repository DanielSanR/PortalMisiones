import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { ModalidadesDataSource } from './modalidades.datasource';
import { ModalityResponseDTO } from '../models/modalidad.dto';
import { toModalidadVM, toModalityRequest } from '../mappers/modalidades.mapper';
import { ModalidadFormValue, ModalidadVM } from '../models/modalidad.vm';
import { sinDialogoGlobal } from '@core/interceptors/http-error.interceptor';

/** Implementación HTTP real (`/api/modality`, §5.3). */
@Injectable()
export class ModalidadesHttpDataSource extends ModalidadesDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/modality`;

  constructor(private http: HttpClient) {
    super();
  }

  list(): Observable<ModalidadVM[]> {
    return this.http
      .get<ResponseDTO<ModalityResponseDTO[]>>(this.apiUrl)
      .pipe(map((res) => res.data.map(toModalidadVM)));
  }

  getById(id: string): Observable<ModalidadVM> {
    return this.http
      .get<ResponseDTO<ModalityResponseDTO>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => toModalidadVM(res.data)));
  }

  create(form: ModalidadFormValue): Observable<ModalidadVM> {
    return this.http
      .post<ResponseDTO<ModalityResponseDTO>>(this.apiUrl, toModalityRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toModalidadVM(res.data)));
  }

  update(id: string, form: ModalidadFormValue): Observable<ModalidadVM> {
    return this.http
      .put<ResponseDTO<ModalityResponseDTO>>(`${this.apiUrl}/${id}`, toModalityRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toModalidadVM(res.data)));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<ResponseDTO<void>>(`${this.apiUrl}/${id}`, sinDialogoGlobal())
      .pipe(map(() => void 0));
  }
}
