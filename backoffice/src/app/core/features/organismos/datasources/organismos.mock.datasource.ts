import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { OrganismosDataSource } from './organismos.datasource';
import { OrganismoFormValue, OrganismoVM } from '../models/organismo.vm';

const DELAY = 200;

/** Implementación mock en memoria (dev offline). typeId/baseLocationId referencian los mocks de tipos/localidades. */
@Injectable()
export class OrganismosMockDataSource extends OrganismosDataSource {
  private data: OrganismoVM[] = [
    { id: 'org-1', typeId: 'tor-2', parentId: null,   baseLocationId: 'loc-posadas', nombre: 'Instituto de Previsión Social', acronym: 'IPS', activo: true },
    { id: 'org-2', typeId: 'tor-2', parentId: null,   baseLocationId: 'loc-posadas', nombre: 'Registro Provincial de las Personas', acronym: 'RPP', activo: true },
    { id: 'org-3', typeId: 'tor-3', parentId: 'org-1', baseLocationId: 'loc-obera',   nombre: 'Dirección General de Rentas', acronym: 'DGR', activo: true },
  ];

  list(): Observable<OrganismoVM[]> {
    return of(this.data.map((o) => ({ ...o }))).pipe(delay(DELAY));
  }

  getById(id: string): Observable<OrganismoVM> {
    const o = this.data.find((x) => x.id === id);
    return o ? of({ ...o }).pipe(delay(DELAY)) : throwError(() => new Error('Organismo no encontrado'));
  }

  create(form: OrganismoFormValue): Observable<OrganismoVM> {
    const nuevo: OrganismoVM = {
      id: `org-${Date.now()}`,
      typeId: form.typeId,
      parentId: form.parentId || null,
      baseLocationId: form.baseLocationId || null,
      nombre: form.nombre,
      acronym: form.acronym,
      activo: form.activo,
    };
    this.data = [...this.data, nuevo];
    return of({ ...nuevo }).pipe(delay(DELAY));
  }

  update(id: string, form: OrganismoFormValue): Observable<OrganismoVM> {
    const idx = this.data.findIndex((x) => x.id === id);
    if (idx < 0) return throwError(() => new Error('Organismo no encontrado'));
    const actualizado: OrganismoVM = {
      id,
      typeId: form.typeId,
      parentId: form.parentId || null,
      baseLocationId: form.baseLocationId || null,
      nombre: form.nombre,
      acronym: form.acronym,
      activo: form.activo,
    };
    this.data = this.data.map((x) => (x.id === id ? actualizado : x));
    return of({ ...actualizado }).pipe(delay(DELAY));
  }

  delete(id: string): Observable<void> {
    this.data = this.data.filter((x) => x.id !== id);
    return of(void 0).pipe(delay(DELAY));
  }
}
