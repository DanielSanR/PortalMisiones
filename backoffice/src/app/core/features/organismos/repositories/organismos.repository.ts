import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ORGANISMOS_DS, OrganismosDataSource } from '../datasources/organismos.datasource';
import { OrganismoOption } from '../models/organismo.vm';

/** Repositorio de organismos (lean, sólo opciones para selects por ahora). */
@Injectable({ providedIn: 'root' })
export class OrganismosRepository {
  constructor(@Inject(ORGANISMOS_DS) private ds: OrganismosDataSource) {}

  getOptions(): Observable<OrganismoOption[]> {
    return this.ds.getOptions();
  }
}
