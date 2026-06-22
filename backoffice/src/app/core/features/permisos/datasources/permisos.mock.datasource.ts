import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { PermisosDataSource } from './permisos.datasource';
import { PermisoFormValue, PermisoVM } from '../models/permiso.vm';

const DELAY = 200;

/** Implementación mock en memoria (para dev offline). Seed desde el catálogo de permisos. */
@Injectable()
export class PermisosMockDataSource extends PermisosDataSource {
  private data: PermisoVM[] = Object.values(PERMISSIONS).map((codigo, i) => ({
    id: `perm-${i + 1}`,
    codigo,
    descripcion: codigo.replace('_', ' ').toLowerCase(),
  }));

  list(): Observable<PermisoVM[]> {
    return of(this.data.map((p) => ({ ...p }))).pipe(delay(DELAY));
  }

  getById(id: string): Observable<PermisoVM> {
    const p = this.data.find((x) => x.id === id);
    return p ? of({ ...p }).pipe(delay(DELAY)) : throwError(() => new Error('Permiso no encontrado'));
  }

  create(form: PermisoFormValue): Observable<PermisoVM> {
    const nuevo: PermisoVM = { id: `perm-${Date.now()}`, codigo: form.codigo, descripcion: form.descripcion };
    this.data = [...this.data, nuevo];
    return of({ ...nuevo }).pipe(delay(DELAY));
  }

  update(id: string, form: PermisoFormValue): Observable<PermisoVM> {
    const idx = this.data.findIndex((x) => x.id === id);
    if (idx < 0) return throwError(() => new Error('Permiso no encontrado'));
    const actualizado: PermisoVM = { id, codigo: form.codigo, descripcion: form.descripcion };
    this.data = this.data.map((x) => (x.id === id ? actualizado : x));
    return of({ ...actualizado }).pipe(delay(DELAY));
  }

  delete(id: string): Observable<void> {
    this.data = this.data.filter((x) => x.id !== id);
    return of(void 0).pipe(delay(DELAY));
  }
}
