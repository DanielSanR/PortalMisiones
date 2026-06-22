import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { OrganismoOption } from '../models/organismo.vm';

/**
 * Fuente de datos de organismos (para selects). El backend NO expone organismos todavía
 * (API spec §7), así que hoy sólo existe la implementación mock.
 */
export abstract class OrganismosDataSource {
  abstract getOptions(): Observable<OrganismoOption[]>;
}

export const ORGANISMOS_DS = new InjectionToken<OrganismosDataSource>('ORGANISMOS_DS');
