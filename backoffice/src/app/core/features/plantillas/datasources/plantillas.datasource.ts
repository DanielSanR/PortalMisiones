import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { PlantillaFormValue, PlantillaVM } from '../models/plantilla.vm';

/**
 * Fuente de datos de plantillas provinciales: HTTP real (`/api/procedure-template`) o mock en
 * memoria, según `featureOverrides`. Los nombres de los catálogos NO los resuelve la fuente
 * (vienen en `null`): los completa el facade.
 */
export abstract class PlantillasDataSource {
  /** Solo las activas (el backend filtra `active=true`). */
  abstract list(): Observable<PlantillaVM[]>;
  /** También devuelve las inactivas. */
  abstract getById(id: string): Observable<PlantillaVM>;
  abstract create(form: PlantillaFormValue): Observable<PlantillaVM>;
  abstract update(id: string, form: PlantillaFormValue): Observable<PlantillaVM>;
  /** Borrado lógico: pone `active=false`. */
  abstract desactivar(id: string): Observable<void>;
}

export const PLANTILLAS_DS = new InjectionToken<PlantillasDataSource>('PLANTILLAS_DS');
