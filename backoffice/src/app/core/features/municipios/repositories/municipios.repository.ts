import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MUNICIPIOS_DS, MunicipiosDataSource } from '../datasources/municipios.datasource';
import { MunicipioVM } from '../models/municipio.vm';

/** Repositorio de municipios. Inyecta el DataSource vía token. Consumible cross-feature. */
@Injectable({ providedIn: 'root' })
export class MunicipiosRepository {
  constructor(@Inject(MUNICIPIOS_DS) private ds: MunicipiosDataSource) {}

  getAll(): Observable<MunicipioVM[]> {
    return this.ds.getAll();
  }
}
