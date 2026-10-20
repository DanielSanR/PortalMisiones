import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PUNTOS_ATENCION_DS, PuntosAtencionDataSource } from '../datasources/puntos-atencion.datasource';
import { PuntoAtencionFormValue, PuntoAtencionVM } from '../models/punto-atencion.vm';

/** Repositorio de puntos de atención. Inyecta el DataSource vía token. */
@Injectable({ providedIn: 'root' })
export class PuntosAtencionRepository {
  constructor(@Inject(PUNTOS_ATENCION_DS) private ds: PuntosAtencionDataSource) {}

  list(): Observable<PuntoAtencionVM[]> {
    return this.ds.list();
  }

  getById(id: string): Observable<PuntoAtencionVM> {
    return this.ds.getById(id);
  }

  create(form: PuntoAtencionFormValue): Observable<PuntoAtencionVM> {
    return this.ds.create(form);
  }

  update(id: string, form: PuntoAtencionFormValue): Observable<PuntoAtencionVM> {
    return this.ds.update(id, form);
  }

  desactivar(id: string): Observable<void> {
    return this.ds.desactivar(id);
  }
}
