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
  /**
   * Reactiva un rol dado de baja. El backend no tiene un endpoint propio: es el `PUT /api/role/{id}` con
   * `active: true` y el resto del rol tal como está (código, alcance, flags y permisos: el PUT los pisa todos).
   * `rol` es el que acaba de devolver `getById` (sin versión en el backend: una fila vieja pisaría cambios ajenos).
   */
  abstract activate(rol: RolVM): Observable<RolVM>;
}

export const ROLES_DS = new InjectionToken<RolesDataSource>('ROLES_DS');
