import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { OrganismoFormValue, OrganismoVM } from '../models/organismo.vm';

/** Fuente de datos de Organismos. TODO requiere SUPERADMIN (§5.2). */
export abstract class OrganismosDataSource {
  abstract list(): Observable<OrganismoVM[]>;
  abstract getById(id: string): Observable<OrganismoVM>;
  abstract create(form: OrganismoFormValue): Observable<OrganismoVM>;
  abstract update(id: string, form: OrganismoFormValue): Observable<OrganismoVM>;
  abstract delete(id: string): Observable<void>;
}

export const ORGANISMOS_DS = new InjectionToken<OrganismosDataSource>('ORGANISMOS_DS');
