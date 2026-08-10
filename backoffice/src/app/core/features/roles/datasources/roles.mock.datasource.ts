import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { RolesDataSource } from './roles.datasource';
import { RolFormValue, RolVM } from '../models/role.vm';

const DELAY = 200;

/** Implementación mock en memoria (dev offline). Seed con los roles reales (§4.2). */
@Injectable()
export class RolesMockDataSource extends RolesDataSource {
  private data: RolVM[] = [
    { id: 'rol-1', codigo: 'SUPERADMIN',         descripcion: 'Superusuario',                  scopeTipo: 'global',    asignablePorOrgAdmin: false, activo: true, permisos: [] },
    { id: 'rol-2', codigo: 'ADMIN_BACKOFFICE',   descripcion: 'Admin de backoffice',           scopeTipo: 'global',    asignablePorOrgAdmin: false, activo: true, permisos: [] },
    { id: 'rol-3', codigo: 'ADMIN_ORGANIZATION', descripcion: 'Admin de organización local',   scopeTipo: 'organismo', asignablePorOrgAdmin: true,  activo: true, permisos: [] },
    { id: 'rol-4', codigo: 'AGENT',              descripcion: 'Operador de trámites',          scopeTipo: 'organismo', asignablePorOrgAdmin: true,  activo: true, permisos: [] },
    { id: 'rol-5', codigo: 'MANAGER',            descripcion: 'Visualizador de estadísticas',  scopeTipo: 'organismo', asignablePorOrgAdmin: true,  activo: true, permisos: [] },
    { id: 'rol-6', codigo: 'USER',               descripcion: 'Usuario final',                 scopeTipo: 'global',    asignablePorOrgAdmin: false, activo: true, permisos: [] },
  ];

  list(): Observable<RolVM[]> {
    return of(this.data.map((r) => ({ ...r }))).pipe(delay(DELAY));
  }

  /** Excluye SUPERADMIN y ADMIN_BACKOFFICE (igual que el backend). */
  listAllowed(): Observable<RolVM[]> {
    const allowed = this.data.filter((r) => !['SUPERADMIN', 'ADMIN_BACKOFFICE'].includes(r.codigo));
    return of(allowed.map((r) => ({ ...r }))).pipe(delay(DELAY));
  }

  getById(id: string): Observable<RolVM> {
    const r = this.data.find((x) => x.id === id);
    return r ? of({ ...r }).pipe(delay(DELAY)) : throwError(() => new Error('Rol no encontrado'));
  }

  create(form: RolFormValue): Observable<RolVM> {
    const nuevo: RolVM = {
      id: `rol-${Date.now()}`,
      codigo: form.codigo,
      descripcion: form.descripcion,
      scopeTipo: form.scopeTipo,
      asignablePorOrgAdmin: form.asignablePorOrgAdmin,
      activo: form.active,
      permisos: [],
    };
    this.data = [...this.data, nuevo];
    return of({ ...nuevo }).pipe(delay(DELAY));
  }

  update(id: string, form: RolFormValue): Observable<RolVM> {
    const idx = this.data.findIndex((x) => x.id === id);
    if (idx < 0) return throwError(() => new Error('Rol no encontrado'));
    const actualizado: RolVM = {
      id,
      codigo: form.codigo,
      descripcion: form.descripcion,
      scopeTipo: form.scopeTipo,
      asignablePorOrgAdmin: form.asignablePorOrgAdmin,
      activo: form.active,
      permisos: this.data[idx].permisos,
    };
    this.data = this.data.map((x) => (x.id === id ? actualizado : x));
    return of({ ...actualizado }).pipe(delay(DELAY));
  }

  delete(id: string): Observable<void> {
    this.data = this.data.filter((x) => x.id !== id);
    return of(void 0).pipe(delay(DELAY));
  }
}
