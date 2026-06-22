import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PERMISOS_DS, PermisosDataSource } from '../datasources/permisos.datasource';
import { PermisoFormValue, PermisoVM } from '../models/permiso.vm';

/** Repositorio de permisos. Inyecta el DataSource vía token. Consumible cross-feature (roles). */
@Injectable({ providedIn: 'root' })
export class PermisosRepository {
  constructor(@Inject(PERMISOS_DS) private ds: PermisosDataSource) {}

  list(): Observable<PermisoVM[]> {
    return this.ds.list();
  }

  getById(id: string): Observable<PermisoVM> {
    return this.ds.getById(id);
  }

  create(form: PermisoFormValue): Observable<PermisoVM> {
    return this.ds.create(form);
  }

  update(id: string, form: PermisoFormValue): Observable<PermisoVM> {
    return this.ds.update(id, form);
  }

  delete(id: string): Observable<void> {
    return this.ds.delete(id);
  }
}
