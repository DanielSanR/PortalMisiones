import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { PermissionResponseDTO } from '@core/models/role.model';
import { PermisosDataSource } from './permisos.datasource';
import { toPermisoVM, toPermissionRequest } from '../mappers/permisos.mapper';
import { PermisoFormValue, PermisoVM } from '../models/permiso.vm';
import { sinDialogoGlobal } from '@core/interceptors/http-error.interceptor';

/** Implementación HTTP real (`/api/permission`, BACKEND_API_SPEC.md §4.5). Todo requiere SUPERADMIN. */
@Injectable()
export class PermisosHttpDataSource extends PermisosDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/permission`;

  constructor(private http: HttpClient) {
    super();
  }

  list(): Observable<PermisoVM[]> {
    return this.http
      .get<ResponseDTO<PermissionResponseDTO[]>>(this.apiUrl)
      .pipe(map((res) => res.data.map(toPermisoVM)));
  }

  getById(id: string): Observable<PermisoVM> {
    return this.http
      .get<ResponseDTO<PermissionResponseDTO>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => toPermisoVM(res.data)));
  }

  create(form: PermisoFormValue): Observable<PermisoVM> {
    return this.http
      .post<ResponseDTO<PermissionResponseDTO>>(this.apiUrl, toPermissionRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toPermisoVM(res.data)));
  }

  update(id: string, form: PermisoFormValue): Observable<PermisoVM> {
    return this.http
      .put<ResponseDTO<PermissionResponseDTO>>(`${this.apiUrl}/${id}`, toPermissionRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toPermisoVM(res.data)));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<ResponseDTO<void>>(`${this.apiUrl}/${id}`, sinDialogoGlobal())
      .pipe(map(() => void 0));
  }
}
