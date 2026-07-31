import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { OrganismosDataSource } from './organismos.datasource';
import { OrganismResponseDTO } from '../models/organismo.dto';
import { toOrganismoVM, toOrganismRequest } from '../mappers/organismos.mapper';
import { OrganismoFormValue, OrganismoVM } from '../models/organismo.vm';

/** Implementación HTTP real (`/api/organism`, SUPERADMIN, §5.2). */
@Injectable()
export class OrganismosHttpDataSource extends OrganismosDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/organism`;

  constructor(private http: HttpClient) {
    super();
  }

  list(): Observable<OrganismoVM[]> {
    return this.http
      .get<ResponseDTO<OrganismResponseDTO[]>>(this.apiUrl)
      .pipe(map((res) => res.data.map(toOrganismoVM)));
  }

  getById(id: string): Observable<OrganismoVM> {
    return this.http
      .get<ResponseDTO<OrganismResponseDTO>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => toOrganismoVM(res.data)));
  }

  create(form: OrganismoFormValue): Observable<OrganismoVM> {
    return this.http
      .post<ResponseDTO<OrganismResponseDTO>>(this.apiUrl, toOrganismRequest(form))
      .pipe(map((res) => toOrganismoVM(res.data)));
  }

  update(id: string, form: OrganismoFormValue): Observable<OrganismoVM> {
    return this.http
      .put<ResponseDTO<OrganismResponseDTO>>(`${this.apiUrl}/${id}`, toOrganismRequest(form))
      .pipe(map((res) => toOrganismoVM(res.data)));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<ResponseDTO<void>>(`${this.apiUrl}/${id}`)
      .pipe(map(() => void 0));
  }
}
