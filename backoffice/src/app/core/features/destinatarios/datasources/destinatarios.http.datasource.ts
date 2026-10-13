import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { DestinatariosDataSource } from './destinatarios.datasource';
import { RecipientResponseDTO } from '../models/destinatario.dto';
import { toDestinatarioVM, toRecipientRequest } from '../mappers/destinatarios.mapper';
import { DestinatarioFormValue, DestinatarioVM } from '../models/destinatario.vm';
import { sinDialogoGlobal } from '@core/interceptors/http-error.interceptor';

/** Implementación HTTP real (`/api/recipient`, §5.4). */
@Injectable()
export class DestinatariosHttpDataSource extends DestinatariosDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/recipient`;

  constructor(private http: HttpClient) {
    super();
  }

  list(): Observable<DestinatarioVM[]> {
    return this.http
      .get<ResponseDTO<RecipientResponseDTO[]>>(this.apiUrl)
      .pipe(map((res) => res.data.map(toDestinatarioVM)));
  }

  getById(id: string): Observable<DestinatarioVM> {
    return this.http
      .get<ResponseDTO<RecipientResponseDTO>>(`${this.apiUrl}/${encodeURIComponent(id)}`)
      .pipe(map((res) => toDestinatarioVM(res.data)));
  }

  create(form: DestinatarioFormValue): Observable<DestinatarioVM> {
    return this.http
      .post<ResponseDTO<RecipientResponseDTO>>(this.apiUrl, toRecipientRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toDestinatarioVM(res.data)));
  }

  update(id: string, form: DestinatarioFormValue): Observable<DestinatarioVM> {
    return this.http
      .put<ResponseDTO<RecipientResponseDTO>>(`${this.apiUrl}/${encodeURIComponent(id)}`, toRecipientRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toDestinatarioVM(res.data)));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<ResponseDTO<void>>(`${this.apiUrl}/${encodeURIComponent(id)}`, sinDialogoGlobal())
      .pipe(map(() => void 0));
  }
}
