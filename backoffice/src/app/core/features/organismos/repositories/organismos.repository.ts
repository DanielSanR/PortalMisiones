import { Inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ORGANISMOS_DS, OrganismosDataSource } from '../datasources/organismos.datasource';
import { OrganismoFormValue, OrganismoOption, OrganismoVM } from '../models/organismo.vm';

/** Repositorio de Organismos. Inyecta el DataSource vía token. `getOptions()` se consume cross-feature (usuarios). */
@Injectable({ providedIn: 'root' })
export class OrganismosRepository {
  constructor(@Inject(ORGANISMOS_DS) private ds: OrganismosDataSource) {}

  list(): Observable<OrganismoVM[]> {
    return this.ds.list();
  }

  /** Opciones (solo activos) para selects de otros features. */
  getOptions(): Observable<OrganismoOption[]> {
    return this.ds.list().pipe(
      map((list) => list.filter((o) => o.activo).map((o) => ({ id: o.id, nombre: o.nombre })))
    );
  }

  getById(id: string): Observable<OrganismoVM> {
    return this.ds.getById(id);
  }

  create(form: OrganismoFormValue): Observable<OrganismoVM> {
    return this.ds.create(form);
  }

  update(id: string, form: OrganismoFormValue): Observable<OrganismoVM> {
    return this.ds.update(id, form);
  }

  delete(id: string): Observable<void> {
    return this.ds.delete(id);
  }
}
