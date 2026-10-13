import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ADOPCIONES_DS, AdopcionesDataSource } from '../datasources/adopciones.datasource';
import { Adopcion, AdopcionFormValue } from '../models/adopcion.vm';

/**
 * Repositorio de adopciones. Inyecta el DataSource vía token. Se exporta en el barrel: lo consume,
 * cross-feature, el facade de fichas por localidad (fase 3) para saber de qué adopción es cada ficha.
 */
@Injectable({ providedIn: 'root' })
export class AdopcionesRepository {
  constructor(@Inject(ADOPCIONES_DS) private ds: AdopcionesDataSource) {}

  list(): Observable<Adopcion[]> {
    return this.ds.list();
  }

  getById(id: string): Observable<Adopcion> {
    return this.ds.getById(id);
  }

  create(form: AdopcionFormValue): Observable<Adopcion> {
    return this.ds.create(form);
  }

  update(id: string, form: AdopcionFormValue): Observable<Adopcion> {
    return this.ds.update(id, form);
  }

  deshabilitar(id: string): Observable<void> {
    return this.ds.deshabilitar(id);
  }
}
