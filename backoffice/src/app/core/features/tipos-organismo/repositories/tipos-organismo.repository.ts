import { Inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { TIPOS_ORGANISMO_DS, TiposOrganismoDataSource } from '../datasources/tipos-organismo.datasource';
import { TipoOrganismoFormValue, TipoOrganismoOption, TipoOrganismoVM } from '../models/tipo-organismo.vm';

/**
 * Repositorio de Tipos de Organismo. Inyecta el DataSource vía token.
 * Expone además `getOptions()` (consumido cross-feature por el form de organismos).
 */
@Injectable({ providedIn: 'root' })
export class TiposOrganismoRepository {
  constructor(@Inject(TIPOS_ORGANISMO_DS) private ds: TiposOrganismoDataSource) {}

  list(): Observable<TipoOrganismoVM[]> {
    return this.ds.list();
  }

  /** Opciones (solo tipos activos) para selects de otros features. */
  getOptions(): Observable<TipoOrganismoOption[]> {
    return this.ds.list().pipe(
      map((tipos) => tipos.filter((t) => t.activo).map((t) => ({ id: t.id, nombre: t.nombre })))
    );
  }

  getById(id: string): Observable<TipoOrganismoVM> {
    return this.ds.getById(id);
  }

  create(form: TipoOrganismoFormValue): Observable<TipoOrganismoVM> {
    return this.ds.create(form);
  }

  update(id: string, form: TipoOrganismoFormValue): Observable<TipoOrganismoVM> {
    return this.ds.update(id, form);
  }

  delete(id: string): Observable<void> {
    return this.ds.delete(id);
  }
}
