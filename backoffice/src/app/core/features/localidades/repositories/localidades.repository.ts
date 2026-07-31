import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LOCALIDADES_DS, LocalidadesDataSource } from '../datasources/localidades.datasource';
import { DepartamentoVM, LocalidadVM } from '../models/localidad.vm';

/** Repositorio de Geografía. Inyecta el DataSource vía token. Consumible cross-feature. */
@Injectable({ providedIn: 'root' })
export class LocalidadesRepository {
  constructor(@Inject(LOCALIDADES_DS) private ds: LocalidadesDataSource) {}

  getDepartamentos(): Observable<DepartamentoVM[]> {
    return this.ds.getDepartamentos();
  }

  getLocalidades(): Observable<LocalidadVM[]> {
    return this.ds.getLocalidades();
  }
}
