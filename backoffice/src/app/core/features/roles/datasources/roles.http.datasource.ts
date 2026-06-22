import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { RoleResponseDTO } from '@core/models/role.model';
import { RolesDataSource } from './roles.datasource';
import { toRolVM, toRoleRequest } from '../mappers/roles.mapper';
import { RolFormValue, RolVM } from '../models/role.vm';

/** Implementación HTTP real (`/api/role`, BACKEND_API_SPEC.md §4.4). */
@Injectable()
export class RolesHttpDataSource extends RolesDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/role`;

  constructor(private http: HttpClient) {
    super();
  }

  list(): Observable<RolVM[]> {
    return this.http
      .get<ResponseDTO<RoleResponseDTO[]>>(this.apiUrl)
      .pipe(map((res) => res.data.map(toRolVM)));
  }

  listAllowed(): Observable<RolVM[]> {
    return this.http
      .get<ResponseDTO<RoleResponseDTO[]>>(`${this.apiUrl}/allowed`)
      .pipe(map((res) => res.data.map(toRolVM)));
  }

  getById(id: string): Observable<RolVM> {
    return this.http
      .get<ResponseDTO<RoleResponseDTO>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => toRolVM(res.data)));
  }

  create(form: RolFormValue): Observable<RolVM> {
    return this.http
      .post<ResponseDTO<RoleResponseDTO>>(this.apiUrl, toRoleRequest(form))
      .pipe(map((res) => toRolVM(res.data)));
  }

  update(id: string, form: RolFormValue): Observable<RolVM> {
    return this.http
      .put<ResponseDTO<RoleResponseDTO>>(`${this.apiUrl}/${id}`, toRoleRequest(form))
      .pipe(map((res) => toRolVM(res.data)));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<ResponseDTO<void>>(`${this.apiUrl}/${id}`)
      .pipe(map(() => void 0));
  }
}
