import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { LugarVM } from '../models/lugar.vm';

/**
 * Fuente de la geocodificación (texto → lugares): Nominatim de OpenStreetMap o un mock en memoria, según
 * `featureOverrides.geocodificacion`. Es un servicio EXTERNO: no va por los interceptores del backend.
 */
export abstract class GeocodificacionDataSource {
  /** Hay un proveedor configurado (`environment.mapa.geocodificacion`). Sin él, `buscar` falla. */
  abstract readonly disponible: boolean;
  /** Lugares que coinciden con el texto (pocos, los más relevantes primero). Vacío si no encontró nada. */
  abstract buscar(consulta: string): Observable<LugarVM[]>;
}

export const GEOCODIFICACION_DS = new InjectionToken<GeocodificacionDataSource>('GEOCODIFICACION_DS');
