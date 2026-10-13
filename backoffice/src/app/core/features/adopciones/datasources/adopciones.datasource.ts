import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Adopcion, AdopcionFormValue } from '../models/adopcion.vm';

/**
 * Fuente de datos de adopciones ("Trámites del organismo"): HTTP real (`/api/organism-procedure`) o
 * mock en memoria, según `featureOverrides`. Devuelve solo ids: los nombres y el estado de vigencia
 * los resuelve el facade.
 */
export abstract class AdopcionesDataSource {
  /** Solo las habilitadas dentro del alcance del usuario (el backend no lista las deshabilitadas). */
  abstract list(): Observable<Adopcion[]>;
  /** También devuelve las deshabilitadas. Fuera del alcance → 404 `4073`. */
  abstract getById(id: string): Observable<Adopcion>;
  abstract create(form: AdopcionFormValue): Observable<Adopcion>;
  /** Reemplazo total. */
  abstract update(id: string, form: AdopcionFormValue): Observable<Adopcion>;
  /** Borrado lógico: pone `enabled=false`. */
  abstract deshabilitar(id: string): Observable<void>;
}

export const ADOPCIONES_DS = new InjectionToken<AdopcionesDataSource>('ADOPCIONES_DS');
