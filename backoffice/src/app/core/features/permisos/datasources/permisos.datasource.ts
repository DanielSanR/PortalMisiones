import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { PermisoFormValue, PermisoVM } from '../models/permiso.vm';

/** Fuente de datos de permisos. Backend real: /api/permission (SUPERADMIN). */
export abstract class PermisosDataSource {
  abstract list(): Observable<PermisoVM[]>;
  abstract getById(id: string): Observable<PermisoVM>;
  abstract create(form: PermisoFormValue): Observable<PermisoVM>;
  abstract update(id: string, form: PermisoFormValue): Observable<PermisoVM>;
  abstract delete(id: string): Observable<void>;
}

export const PERMISOS_DS = new InjectionToken<PermisosDataSource>('PERMISOS_DS');
