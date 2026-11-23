import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, throwError } from 'rxjs';
import { EncuadreDeMapa } from '@core/models/ubicacion.model';
import { GeocodificacionRepository } from '../repositories/geocodificacion.repository';
import { LugarVM } from '../models/lugar.vm';
import { consultaDeDireccion, consultaDeLocalidad } from '../domain/consultas';

/** Zoom con el que se muestra una localidad entera (barrios y calles principales a la vista). */
export const ZOOM_DE_LOCALIDAD = 14;

/**
 * Geocodificación (dirección → lugar), para ubicar un punto en el mapa. Servicio externo (Nominatim) o mock.
 *
 * - `buscarDireccion`: UNA consulta por acción de la persona ("Ubicar en el mapa"). Falla tal cual (la pantalla
 *   cuenta el error con texto propio); sin resultados, emite `[]`.
 * - `encuadreDeLocalidad`: dónde abrir el mapa en un alta. Se consulta una sola vez por localidad en toda la
 *   sesión (caché), y nunca falla: si no hay proveedor o algo sale mal, emite `null` (el mapa abre en la provincia).
 */
@Injectable({ providedIn: 'root' })
export class GeocodificacionFacade {
  private readonly encuadres = new Map<string, Observable<EncuadreDeMapa | null>>();

  constructor(private repo: GeocodificacionRepository) {}

  /** Hay proveedor configurado en este entorno. */
  get disponible(): boolean {
    return this.repo.disponible;
  }

  buscarDireccion(direccion: string, localidad: string | null): Observable<LugarVM[]> {
    const consulta = consultaDeDireccion(direccion, localidad);
    if (!consulta) return of([]);
    if (!this.disponible) return throwError(() => new Error('Sin proveedor de geocodificación'));
    return this.repo.buscar(consulta);
  }

  encuadreDeLocalidad(localidad: string | null): Observable<EncuadreDeMapa | null> {
    const consulta = consultaDeLocalidad(localidad);
    if (!consulta || !this.disponible) return of(null);
    let encuadre$ = this.encuadres.get(consulta);
    if (!encuadre$) {
      encuadre$ = this.repo.buscar(consulta).pipe(
        map((lugares): EncuadreDeMapa | null => (lugares[0] ? { centro: lugares[0].coordenadas, zoom: ZOOM_DE_LOCALIDAD } : null)),
        catchError(() => {
          // Un error no se cachea: la próxima apertura vuelve a intentar.
          this.encuadres.delete(consulta);
          return of(null);
        }),
        shareReplay(1),
      );
      this.encuadres.set(consulta, encuadre$);
    }
    return encuadre$;
  }
}
