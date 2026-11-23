import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { errorDeNegocio } from '@core/mocks/mock-errors';
import { AuthTokenService } from '@core/services/auth-token.service';
import { UserRole } from '@core/enums/user-role.enum';
import { RolesDataSource } from './roles.datasource';
import { RolFormValue, RolVM } from '../models/role.vm';

const DELAY = 200;

/**
 * Implementación mock en memoria (dev offline). Seed con los roles reales (§4.2) y su scope real
 * (`V2.17`: solo ADMIN_ORGANIZATION y AGENT son de organismo).
 *
 * Lee la sesión (`AuthTokenService`) para `listAllowed`: el backend la saca del JWT del request, y acá no
 * hay request. Es infraestructura de sesión, no otro datasource.
 */
@Injectable()
export class RolesMockDataSource extends RolesDataSource {
  private data: RolVM[] = [
    { id: 'rol-1', codigo: 'SUPERADMIN',         descripcion: 'Superusuario',                  scopeTipo: 'global',    asignablePorOrgAdmin: false, asignablePorBackoffice: false, activo: true, permisos: [] },
    { id: 'rol-2', codigo: 'ADMIN_BACKOFFICE',   descripcion: 'Admin de backoffice',           scopeTipo: 'global',    asignablePorOrgAdmin: false, asignablePorBackoffice: false, activo: true, permisos: [] },
    { id: 'rol-3', codigo: 'ADMIN_ORGANIZATION', descripcion: 'Admin de organización local',   scopeTipo: 'organismo', asignablePorOrgAdmin: true, asignablePorBackoffice: true,  activo: true, permisos: [] },
    { id: 'rol-4', codigo: 'AGENT',              descripcion: 'Operador de trámites',          scopeTipo: 'organismo', asignablePorOrgAdmin: true, asignablePorBackoffice: true,  activo: true, permisos: [] },
    { id: 'rol-5', codigo: 'MANAGER',            descripcion: 'Visualizador de estadísticas',  scopeTipo: 'global',    asignablePorOrgAdmin: true, asignablePorBackoffice: false,  activo: true, permisos: [] },
    { id: 'rol-6', codigo: 'USER',               descripcion: 'Usuario final',                 scopeTipo: 'global',    asignablePorOrgAdmin: false, asignablePorBackoffice: true, activo: true, permisos: [] },
  ];

  // Los ids `rol-N` y sus alcances están repetidos en `usuarios.mock.datasource.ts` (ROLES_ASIGNABLES):
  // un datasource no puede leer a otro, así que si cambia este seed hay que cambiar aquél.
  constructor(private auth: AuthTokenService) {
    super();
  }

  list(): Observable<RolVM[]> {
    return of(this.data.map((r) => ({ ...r }))).pipe(delay(DELAY));
  }

  /**
   * Igual que `GET /api/role/allowed`: SUPERADMIN recibe todos; ADMIN_BACKOFFICE, los asignables por
   * backoffice; el resto (ADMIN_ORGANIZATION), los asignables por el admin de organismo. Como el real,
   * no filtra los desactivados.
   */
  listAllowed(): Observable<RolVM[]> {
    const roles = this.auth.getUserRoles();
    const allowed = roles.includes(UserRole.SUPERADMIN)
      ? this.data
      : this.data.filter((r) => (roles.includes(UserRole.ADMIN_BACKOFFICE) ? r.asignablePorBackoffice : r.asignablePorOrgAdmin));
    return of(allowed.map((r) => ({ ...r }))).pipe(delay(DELAY));
  }

  getById(id: string): Observable<RolVM> {
    const r = this.data.find((x) => x.id === id);
    // Mismo rechazo que `GET /api/role/{id}`: 404 `4059`.
    return r ? of({ ...r }).pipe(delay(DELAY)) : errorDeNegocio(API_CODES.ROLE_NOT_FOUND, 'Rol no encontrado.');
  }

  create(form: RolFormValue): Observable<RolVM> {
    const nuevo: RolVM = {
      id: `rol-${Date.now()}`,
      codigo: form.codigo,
      descripcion: form.descripcion,
      scopeTipo: form.scopeTipo,
      asignablePorOrgAdmin: form.asignablePorOrgAdmin,
      asignablePorBackoffice: form.asignablePorBackoffice,
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
      asignablePorBackoffice: form.asignablePorBackoffice,
      activo: form.active,
      permisos: this.data[idx].permisos,
    };
    this.data = this.data.map((x) => (x.id === id ? actualizado : x));
    return of({ ...actualizado }).pipe(delay(DELAY));
  }

  /** Baja lógica, como `RoleService.deleteRole`: el rol queda desactivado y se sigue listando. */
  delete(id: string): Observable<void> {
    if (!this.data.some((x) => x.id === id)) return throwError(() => new Error('Rol no encontrado'));
    this.data = this.data.map((x) => (x.id === id ? { ...x, activo: false } : x));
    return of(void 0).pipe(delay(DELAY));
  }

  /**
   * Como el real (`PUT` con `active: true`): reemplaza el rol con lo que llega, permisos incluidos. Un rol que
   * no existe falla igual que `RoleService.updateRole`: 404 `4059`.
   */
  activate(rol: RolVM): Observable<RolVM> {
    const idx = this.data.findIndex((x) => x.id === rol.id);
    if (idx < 0) return errorDeNegocio(API_CODES.ROLE_NOT_FOUND, 'Rol no encontrado.');
    const activo: RolVM = { ...rol, activo: true, permisos: rol.permisos.map((p) => ({ ...p })) };
    this.data = this.data.map((x) => (x.id === rol.id ? activo : x));
    return of({ ...activo }).pipe(delay(DELAY));
  }
}
