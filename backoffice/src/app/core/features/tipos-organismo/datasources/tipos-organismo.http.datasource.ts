import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { TiposOrganismoDataSource } from './tipos-organismo.datasource';
import { OrganismTypeResponseDTO } from '../models/tipo-organismo.dto';
import { toTipoOrganismoVM, toOrganismTypeRequest } from '../mappers/tipos-organismo.mapper';
import { TipoOrganismoFormValue, TipoOrganismoVM } from '../models/tipo-organismo.vm';
import { sinDialogoGlobal } from '@core/interceptors/http-error.interceptor';

/** Implementación HTTP real (`/api/organism-type`, SUPERADMIN, §5.2). */
@Injectable()
export class TiposOrganismoHttpDataSource extends TiposOrganismoDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/organism-type`;

  constructor(private http: HttpClient) {
    super();
  }

  list(): Observable<TipoOrganismoVM[]> {
    return this.http
      .get<ResponseDTO<OrganismTypeResponseDTO[]>>(this.apiUrl)
      .pipe(map((res) => res.data.map(toTipoOrganismoVM)));
  }

  getById(id: string): Observable<TipoOrganismoVM> {
    return this.http
      .get<ResponseDTO<OrganismTypeResponseDTO>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => toTipoOrganismoVM(res.data)));
  }

  create(form: TipoOrganismoFormValue): Observable<TipoOrganismoVM> {
    return this.http
      .post<ResponseDTO<OrganismTypeResponseDTO>>(this.apiUrl, toOrganismTypeRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toTipoOrganismoVM(res.data)));
  }

  update(id: string, form: TipoOrganismoFormValue): Observable<TipoOrganismoVM> {
    return this.http
      .put<ResponseDTO<OrganismTypeResponseDTO>>(`${this.apiUrl}/${id}`, toOrganismTypeRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toTipoOrganismoVM(res.data)));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<ResponseDTO<void>>(`${this.apiUrl}/${id}`, sinDialogoGlobal())
      .pipe(map(() => void 0));
  }
}
