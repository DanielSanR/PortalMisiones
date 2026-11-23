import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GEOCODIFICACION_DS, GeocodificacionDataSource } from '../datasources/geocodificacion.datasource';
import { LugarVM } from '../models/lugar.vm';

/** Repositorio de la geocodificación. Inyecta el DataSource vía token. */
@Injectable({ providedIn: 'root' })
export class GeocodificacionRepository {
  constructor(@Inject(GEOCODIFICACION_DS) private ds: GeocodificacionDataSource) {}

  get disponible(): boolean {
    return this.ds.disponible;
  }

  buscar(consulta: string): Observable<LugarVM[]> {
    return this.ds.buscar(consulta);
  }
}
