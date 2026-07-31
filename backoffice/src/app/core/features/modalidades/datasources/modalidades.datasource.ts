import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ModalidadFormValue, ModalidadVM } from '../models/modalidad.vm';

/** Fuente de datos de Modalidades. Reads públicos; escrituras SUPERADMIN/ADMIN_BACKOFFICE (§5.3). */
export abstract class ModalidadesDataSource {
  abstract list(): Observable<ModalidadVM[]>;
  abstract getById(id: string): Observable<ModalidadVM>;
  abstract create(form: ModalidadFormValue): Observable<ModalidadVM>;
  abstract update(id: string, form: ModalidadFormValue): Observable<ModalidadVM>;
  abstract delete(id: string): Observable<void>;
}

export const MODALIDADES_DS = new InjectionToken<ModalidadesDataSource>('MODALIDADES_DS');
