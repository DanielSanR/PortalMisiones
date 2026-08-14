import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';
import { TramitesRepository } from '../repositories/tramites.repository';
import {
  ContenidoLocalidadFormValue,
  ContenidoLocalidadVM,
  FeedbackResumenVM,
  TramiteCatalogos,
  TramiteConteos,
  TramiteFormData,
  TramiteFormValue,
  TramiteListQuery,
  TramitePage,
  TramiteVM,
} from '../models/tramite.vm';

/**
 * Facade de Trámites. Expone Observables (async pipe; NO signals) y depende solo del
 * repositorio.
 *
 * A diferencia de los ABM chicos, no cachea la lista en un BehaviorSubject: el listado
 * es paginado y filtrado del lado del servidor, así que cada consulta es una página
 * distinta y guardarla induciría a mostrar datos viejos tras un cambio de filtro.
 */
@Injectable({ providedIn: 'root' })
export class TramitesFacade {
  constructor(private repo: TramitesRepository) {}

  list(query: TramiteListQuery): Observable<TramitePage> {
    return this.repo.list(query);
  }

  conteos(query: TramiteListQuery): Observable<TramiteConteos> {
    return this.repo.conteos(query);
  }

  getById(id: string): Observable<TramiteVM> {
    return this.repo.getById(id);
  }

  /** Catálogos sueltos: los selects de filtro de la lista (organismo, localidad). */
  getCatalogos(): Observable<TramiteCatalogos> {
    return this.repo.getCatalogos();
  }

  /**
   * Todo lo que el formulario necesita, en una sola suscripción: catálogos y —si es
   * edición— el trámite. Que sea una sola llamada es lo que permite a la pantalla
   * mostrar un único estado de carga y un único estado de error, en vez de renderizar
   * un formulario vacío mientras llegan ocho respuestas sueltas.
   */
  getFormData(id?: string): Observable<TramiteFormData> {
    return forkJoin({
      catalogos: this.repo.getCatalogos(),
      tramite: id ? this.repo.getById(id) : of(null),
      // Solo en alta: en edición el organismo lo trae el trámite, y sugerir otro
      // sería proponer moverlo de organismo sin que nadie lo haya pedido.
      organismoIdSugerido: id ? of(null) : this.repo.getOrganismoDelUsuario(),
    });
  }

  create(form: TramiteFormValue): Observable<TramiteVM> {
    return this.repo.create(form);
  }

  update(id: string, form: TramiteFormValue): Observable<TramiteVM> {
    return this.repo.update(id, form);
  }

  delete(id: string): Observable<void> {
    return this.repo.delete(id);
  }

  /**
   * Valoraciones ciudadanas del trámite, agregadas. Va aparte del `getById` a propósito:
   * un feedback caído no puede impedir que se vea la ficha, ni la ficha puede tapar que
   * el feedback no se pudo traer.
   */
  getFeedbackResumen(tramiteId: string): Observable<FeedbackResumenVM> {
    return this.repo.getFeedbackResumen(tramiteId);
  }

  // ── Workflow: borrador → revisión → publicado ↔ despublicado ────────────

  sendToReview(id: string): Observable<TramiteVM> {
    return this.repo.sendToReview(id);
  }

  publish(id: string): Observable<TramiteVM> {
    return this.repo.publish(id);
  }

  unpublish(id: string): Observable<TramiteVM> {
    return this.repo.unpublish(id);
  }

  // ── Contenido por localidad ─────────────────────────────────────────────

  listContenidoLocalidad(tramiteId: string): Observable<ContenidoLocalidadVM[]> {
    return this.repo.listContenidoLocalidad(tramiteId);
  }

  /** Las localidades que todavía no tienen contenido propio, para el select del alta. */
  localidadesDisponibles(tramiteId: string): Observable<{ id: number | string; nombre: string }[]> {
    return forkJoin({
      catalogos: this.repo.getCatalogos(),
      usadas: this.repo.listContenidoLocalidad(tramiteId),
    }).pipe(
      map(({ catalogos, usadas }) => {
        const ocupadas = new Set(usadas.map((c) => c.localidadId));
        return catalogos.localidades.filter((localidad) => !ocupadas.has(Number(localidad.id)));
      }),
    );
  }

  addContenidoLocalidad(tramiteId: string, form: ContenidoLocalidadFormValue): Observable<ContenidoLocalidadVM> {
    return this.repo.addContenidoLocalidad(tramiteId, form);
  }

  updateContenidoLocalidad(tramiteId: string, localidadId: number, form: ContenidoLocalidadFormValue): Observable<ContenidoLocalidadVM> {
    return this.repo.updateContenidoLocalidad(tramiteId, localidadId, form);
  }

  removeContenidoLocalidad(tramiteId: string, localidadId: number): Observable<void> {
    return this.repo.removeContenidoLocalidad(tramiteId, localidadId);
  }
}
