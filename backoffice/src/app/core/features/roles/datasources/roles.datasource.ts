import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { RolFormValue, RolVM } from '../models/role.vm';

/** Fuente de datos de roles. Backend real: /api/role (SUPERADMIN; `allowed` para admins). */
export abstract class RolesDataSource {
  abstract list(): Observable<RolVM[]>;
  /** Roles asignables (excluye SUPERADMIN y ADMIN_BACKOFFICE) — para selects de creación de usuarios. */
  abstract listAllowed(): Observable<RolVM[]>;
  abstract getById(id: string): Observable<RolVM>;
  abstract create(form: RolFormValue): Observable<RolVM>;
  abstract update(id: string, form: RolFormValue): Observable<RolVM>;
  abstract delete(id: string): Observable<void>;
}

export const ROLES_DS = new InjectionToken<RolesDataSource>('ROLES_DS');
