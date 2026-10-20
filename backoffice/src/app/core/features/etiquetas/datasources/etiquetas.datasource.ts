import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { EtiquetaFormValue, EtiquetaVM } from '../models/etiqueta.vm';

/**
 * Fuente de datos de etiquetas: HTTP real (`/api/tag`) o mock en memoria, según `featureOverrides`.
 * `organismoNombre` NO lo resuelve la fuente (viene en `null`): lo completa el facade.
 */
export abstract class EtiquetasDataSource {
  abstract list(): Observable<EtiquetaVM[]>;
  abstract getById(id: string): Observable<EtiquetaVM>;
  abstract create(form: EtiquetaFormValue): Observable<EtiquetaVM>;
  abstract update(id: string, form: EtiquetaFormValue): Observable<EtiquetaVM>;
  abstract delete(id: string): Observable<void>;
}

export const ETIQUETAS_DS = new InjectionToken<EtiquetasDataSource>('ETIQUETAS_DS');
