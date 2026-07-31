import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { TipoOrganismoFormValue, TipoOrganismoVM } from '../models/tipo-organismo.vm';

/** Fuente de datos de Tipos de Organismo. TODO requiere SUPERADMIN (§5.2). */
export abstract class TiposOrganismoDataSource {
  abstract list(): Observable<TipoOrganismoVM[]>;
  abstract getById(id: string): Observable<TipoOrganismoVM>;
  abstract create(form: TipoOrganismoFormValue): Observable<TipoOrganismoVM>;
  abstract update(id: string, form: TipoOrganismoFormValue): Observable<TipoOrganismoVM>;
  abstract delete(id: string): Observable<void>;
}

export const TIPOS_ORGANISMO_DS = new InjectionToken<TiposOrganismoDataSource>('TIPOS_ORGANISMO_DS');
