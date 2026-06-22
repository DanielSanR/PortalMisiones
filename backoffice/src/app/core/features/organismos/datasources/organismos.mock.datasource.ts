import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { OrganismosDataSource } from './organismos.datasource';
import { OrganismoOption } from '../models/organismo.vm';
import { OrganismoService } from '@core/services/organismo.service';

/** Implementación mock: envuelve `OrganismoService` y mapea a opciones de select. */
@Injectable()
export class OrganismosMockDataSource extends OrganismosDataSource {
  constructor(private organismos: OrganismoService) {
    super();
  }

  getOptions(): Observable<OrganismoOption[]> {
    return this.organismos
      .getAll()
      .pipe(map((res) => res.data.map((o) => ({ id: o.id, nombre: o.nombre }))));
  }
}
