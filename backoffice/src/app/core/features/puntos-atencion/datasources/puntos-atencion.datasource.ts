import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { PuntosAtencionFiltro } from '../models/punto-atencion.dto';
import { PuntoAtencionFormValue, PuntoAtencionVM } from '../models/punto-atencion.vm';

/**
 * Fuente de datos de puntos de atención (`/api/attention-point`): HTTP real o mock en memoria, según
 * `featureOverrides`.
 */
export abstract class PuntosAtencionDataSource {
  /** `true` si los datos son simulados (mock en memoria) y no se guardan en el servidor. */
  abstract readonly fuenteSimulada: boolean;
  /**
   * Sin filtro: TODOS los puntos del alcance, activos e inactivos. Con `filtro.fichaId`
   * (`?organismProcedureLocationId=`): los de esa ficha, pero SOLO los activos (así lo resuelve el backend).
   */
  abstract list(filtro?: PuntosAtencionFiltro): Observable<PuntoAtencionVM[]>;
  abstract getById(id: string): Observable<PuntoAtencionVM>;
  abstract create(form: PuntoAtencionFormValue): Observable<PuntoAtencionVM>;
  /** Reemplazo total. */
  abstract update(id: string, form: PuntoAtencionFormValue): Observable<PuntoAtencionVM>;
  /** Borrado lógico: `active=false`. */
  abstract desactivar(id: string): Observable<void>;
}

export const PUNTOS_ATENCION_DS = new InjectionToken<PuntosAtencionDataSource>('PUNTOS_ATENCION_DS');
