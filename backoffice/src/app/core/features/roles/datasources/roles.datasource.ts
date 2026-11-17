import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { RolFormValue, RolVM } from '../models/role.vm';

/** Fuente de datos de roles. Backend real: /api/role (SUPERADMIN; `allowed` para admins). */
export abstract class RolesDataSource {
  abstract list(): Observable<RolVM[]>;
  /**
   * Roles que la sesión puede asignar, para los selects de usuarios: SUPERADMIN recibe todos;
   * ADMIN_BACKOFFICE y ADMIN_ORGANIZATION, los marcados como asignables por cada uno.
   */
  abstract listAllowed(): Observable<RolVM[]>;
  abstract getById(id: string): Observable<RolVM>;
  abstract create(form: RolFormValue): Observable<RolVM>;
  abstract update(id: string, form: RolFormValue): Observable<RolVM>;
  /** Baja lógica: el rol queda desactivado (`active = false`) y se sigue listando. */
  abstract delete(id: string): Observable<void>;
}

export const ROLES_DS = new InjectionToken<RolesDataSource>('ROLES_DS');
