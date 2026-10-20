import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { PuntoAtencionFormValue, PuntoAtencionVM } from '../models/punto-atencion.vm';

/**
 * Fuente de datos de puntos de atención (`/api/attention-point`): HTTP real o mock en memoria, según
 * `featureOverrides`. El backend no filtra por ficha: `list()` trae TODOS los del alcance (activos e
 * inactivos) y el facade filtra.
 */
export abstract class PuntosAtencionDataSource {
  abstract list(): Observable<PuntoAtencionVM[]>;
  abstract getById(id: string): Observable<PuntoAtencionVM>;
  abstract create(form: PuntoAtencionFormValue): Observable<PuntoAtencionVM>;
  /** Reemplazo total. */
  abstract update(id: string, form: PuntoAtencionFormValue): Observable<PuntoAtencionVM>;
  /** Borrado lógico: `active=false`. */
  abstract desactivar(id: string): Observable<void>;
}

export const PUNTOS_ATENCION_DS = new InjectionToken<PuntosAtencionDataSource>('PUNTOS_ATENCION_DS');
