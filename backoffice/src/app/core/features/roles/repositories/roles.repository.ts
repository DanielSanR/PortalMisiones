import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ROLES_DS, RolesDataSource } from '../datasources/roles.datasource';
import { RolFormValue, RolVM } from '../models/role.vm';

/** Repositorio de roles. Inyecta el DataSource vía token. Consumible cross-feature (usuarios). */
@Injectable({ providedIn: 'root' })
export class RolesRepository {
  constructor(@Inject(ROLES_DS) private ds: RolesDataSource) {}

  list(): Observable<RolVM[]> {
    return this.ds.list();
  }

  listAllowed(): Observable<RolVM[]> {
    return this.ds.listAllowed();
  }

  getById(id: string): Observable<RolVM> {
    return this.ds.getById(id);
  }

  create(form: RolFormValue): Observable<RolVM> {
    return this.ds.create(form);
  }

  update(id: string, form: RolFormValue): Observable<RolVM> {
    return this.ds.update(id, form);
  }

  delete(id: string): Observable<void> {
    return this.ds.delete(id);
  }
}
