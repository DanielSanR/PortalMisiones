import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
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

/**
 * Fuente de datos de Trámites. Cubre el ABM, el workflow
 * (borrador → revisión → publicado ↔ despublicado) y el contenido por localidad.
 */
export abstract class TramitesDataSource {
  abstract list(query: TramiteListQuery): Observable<TramitePage>;
  /**
   * Catálogos del formulario (organismos, modalidades, etiquetas…).
   *
   * Viven acá y no en el facade tirando de los repositorios de otros features a
   * propósito: los features ya migrados hablan el contrato real (UUID) y el mock de
   * trámites todavía habla el viejo (ids numéricos). Mezclarlos daría selects cuyos
   * ids el endpoint de trámites no reconoce. El DataSource es la única capa que sabe
   * de qué fuente viene cada cosa, así que la incompatibilidad se resuelve donde
   * corresponde y no se filtra hacia arriba.
   */
  abstract getCatalogos(): Observable<TramiteCatalogos>;
  /** Conteos por estado, sin el filtro de estado aplicado: los chips no deben contar lo que ellos mismos filtran. */
  abstract conteos(query: TramiteListQuery): Observable<TramiteConteos>;
  abstract getById(id: string): Observable<TramiteVM>;
  abstract create(form: TramiteFormValue): Observable<TramiteVM>;
  abstract update(id: string, form: TramiteFormValue): Observable<TramiteVM>;
  abstract delete(id: string): Observable<void>;

  // ── Workflow ────────────────────────────────────────────────────────────
  abstract sendToReview(id: string): Observable<TramiteVM>;
  abstract publish(id: string): Observable<TramiteVM>;
  abstract unpublish(id: string): Observable<TramiteVM>;

  // ── Contenido por localidad ─────────────────────────────────────────────
  abstract listContenidoLocalidad(tramiteId: string): Observable<ContenidoLocalidadVM[]>;
  abstract addContenidoLocalidad(tramiteId: string, form: ContenidoLocalidadFormValue): Observable<ContenidoLocalidadVM>;
  abstract updateContenidoLocalidad(tramiteId: string, localidadId: number, form: ContenidoLocalidadFormValue): Observable<ContenidoLocalidadVM>;
  abstract removeContenidoLocalidad(tramiteId: string, localidadId: number): Observable<void>;
}

export const TRAMITES_DS = new InjectionToken<TramitesDataSource>('TRAMITES_DS');
