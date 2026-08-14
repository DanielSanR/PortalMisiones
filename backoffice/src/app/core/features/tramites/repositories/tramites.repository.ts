import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TRAMITES_DS, TramitesDataSource } from '../datasources/tramites.datasource';
import {
  ContenidoLocalidadFormValue,
  ContenidoLocalidadVM,
  TramiteCatalogos,
  TramiteConteos,
  TramiteFormValue,
  TramiteListQuery,
  TramitePage,
  TramiteVM,
} from '../models/tramite.vm';

/** Repositorio de Trámites. Inyecta el DataSource vía token, nunca una clase concreta. */
@Injectable({ providedIn: 'root' })
export class TramitesRepository {
  constructor(@Inject(TRAMITES_DS) private ds: TramitesDataSource) {}

  list(query: TramiteListQuery): Observable<TramitePage> {
    return this.ds.list(query);
  }

  getCatalogos(): Observable<TramiteCatalogos> {
    return this.ds.getCatalogos();
  }

  conteos(query: TramiteListQuery): Observable<TramiteConteos> {
    return this.ds.conteos(query);
  }

  getById(id: string): Observable<TramiteVM> {
    return this.ds.getById(id);
  }

  create(form: TramiteFormValue): Observable<TramiteVM> {
    return this.ds.create(form);
  }

  update(id: string, form: TramiteFormValue): Observable<TramiteVM> {
    return this.ds.update(id, form);
  }

  delete(id: string): Observable<void> {
    return this.ds.delete(id);
  }

  sendToReview(id: string): Observable<TramiteVM> {
    return this.ds.sendToReview(id);
  }

  publish(id: string): Observable<TramiteVM> {
    return this.ds.publish(id);
  }

  unpublish(id: string): Observable<TramiteVM> {
    return this.ds.unpublish(id);
  }

  listContenidoLocalidad(tramiteId: string): Observable<ContenidoLocalidadVM[]> {
    return this.ds.listContenidoLocalidad(tramiteId);
  }

  addContenidoLocalidad(tramiteId: string, form: ContenidoLocalidadFormValue): Observable<ContenidoLocalidadVM> {
    return this.ds.addContenidoLocalidad(tramiteId, form);
  }

  updateContenidoLocalidad(tramiteId: string, localidadId: number, form: ContenidoLocalidadFormValue): Observable<ContenidoLocalidadVM> {
    return this.ds.updateContenidoLocalidad(tramiteId, localidadId, form);
  }

  removeContenidoLocalidad(tramiteId: string, localidadId: number): Observable<void> {
    return this.ds.removeContenidoLocalidad(tramiteId, localidadId);
  }
}
