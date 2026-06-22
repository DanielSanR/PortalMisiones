import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { EtiquetaFormValue, EtiquetaVM } from '../models/etiqueta.vm';

/**
 * Fuente de datos de etiquetas. BLOQUEADA por backend: hoy solo existe la impl mock.
 * Cuando el backend exponga el CRUD, se agrega `*.http.datasource.ts` y se cambia el override.
 */
export abstract class EtiquetasDataSource {
  abstract list(): Observable<EtiquetaVM[]>;
  abstract getById(id: number): Observable<EtiquetaVM>;
  abstract create(form: EtiquetaFormValue): Observable<EtiquetaVM>;
  abstract update(id: number, form: EtiquetaFormValue): Observable<EtiquetaVM>;
  abstract delete(id: number): Observable<void>;
}

export const ETIQUETAS_DS = new InjectionToken<EtiquetasDataSource>('ETIQUETAS_DS');
