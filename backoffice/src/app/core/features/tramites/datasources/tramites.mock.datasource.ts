import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';
import { TramiteService } from '@core/services/tramite.service';
import { AuthTokenService } from '@core/services/auth-token.service';
import { FeedbackService } from '@core/services/feedback.service';
import { OrganismoService } from '@core/services/organismo.service';
import { LocalidadService } from '@core/services/localidad.service';
import { CategoriaService } from '@core/services/categoria.service';
import { DestinatarioService } from '@core/services/destinatario.service';
import { EventoDeVidaService } from '@core/services/evento-de-vida.service';
import { TramiteFilter } from '@core/models/tramite.model';
import { TramitesDataSource } from './tramites.datasource';
import {
  toContenidoLocalidadDTO,
  toContenidoLocalidadVM,
  toTramiteCreateDTO,
  toTramiteVM,
} from '../mappers/tramites.mapper';
import {
  ContenidoLocalidadFormValue,
  ContenidoLocalidadVM,
  FeedbackResumenVM,
  TramiteCatalogos,
  TramiteConteos,
  TramiteFormValue,
  TramiteListQuery,
  TramitePage,
  TramiteVM,
} from '../models/tramite.vm';

/**
 * Se pide todo de una y el orden y el corte de página se resuelven acá.
 *
 * El backend mockeado filtra pero no ordena, y ordenar solo la página visible daría un
 * orden falso (ordenaría 10 filas de N). Con los volúmenes del mock traer todo es
 * barato; cuando exista el endpoint real, el HttpDataSource manda `sortBy`/`sortDir`
 * y esta clase queda como está.
 */
const TRAER_TODO = 10_000;

/** Cuántas valoraciones se piden para agregar el resumen, y cuántas se muestran. */
const FEEDBACK_PAGINA = 100;
const FEEDBACK_MUESTRA = 5;

@Injectable()
export class TramitesMockDataSource extends TramitesDataSource {
  constructor(
    private tramites: TramiteService,
    private auth: AuthTokenService,
    private feedback: FeedbackService,
    private organismos: OrganismoService,
    private localidades: LocalidadService,
    private categorias: CategoriaService,
    private destinatarios: DestinatarioService,
    private eventosDeVida: EventoDeVidaService,
  ) {
    super();
  }

  /**
   * Un `forkJoin` falla entero si falla una sola fuente, y eso es lo que se quiere acá:
   * un formulario al que le falta un catálogo produce trámites incompletos en silencio.
   * Mejor que falle fuerte y la pantalla lo cuente.
   */
  getCatalogos(): Observable<TramiteCatalogos> {
    return forkJoin({
      organismos: this.organismos.getAll().pipe(map((r) => r.data.map((o) => ({ id: o.id, nombre: o.nombre })))),
      modalidades: this.tramites.getModalidades().pipe(map((m) => m.map((x) => ({ id: x.id, nombre: x.nombre })))),
      etiquetas: this.tramites.getEtiquetas().pipe(map((e) => e.map((x) => ({ id: x.id, nombre: x.nombre })))),
      categorias: this.categorias.getAll().pipe(map((r) => this.aplanarCategorias(r.data))),
      destinatarios: this.destinatarios.getAll().pipe(map((d) => d.map((x) => ({ id: x.id, nombre: x.nombre })))),
      localidades: this.localidades.getAll().pipe(
        map((r) => r.data.map((l) => ({ id: l.id, nombre: `${l.nombre} (${l.departamento})` }))),
      ),
      eventosDeVida: this.eventosDeVida.getAll().pipe(map((r) => r.data.map((e) => ({ id: e.id, nombre: e.nombre })))),
    });
  }

  /**
   * Hoy el organismo del usuario viaja en el JWT. Se lee acá y no en la pantalla para
   * que el día que venga de un endpoint —o deje de existir— no haya que tocar el
   * formulario.
   */
  getOrganismoDelUsuario(): Observable<string | null> {
    return of(this.auth.getUserOrganismoId());
  }

  /** Solo las hojas, prefijadas con su padre: un trámite se clasifica en una subcategoría. */
  private aplanarCategorias(padres: { nombre: string; children?: { id: number | string; nombre: string }[] }[]) {
    return padres.flatMap((padre) =>
      (padre.children ?? []).map((hija) => ({ id: hija.id, nombre: `${padre.nombre} > ${hija.nombre}` })),
    );
  }

  list(query: TramiteListQuery): Observable<TramitePage> {
    return this.tramites.getAll(this.toFilter(query)).pipe(
      map((res) => {
        const todas = res.data.map(toTramiteVM);
        const ordenadas = this.ordenar(todas, query.sortBy, query.sortDir);
        const desde = query.page * query.pageSize;
        return { rows: ordenadas.slice(desde, desde + query.pageSize), total: ordenadas.length };
      }),
    );
  }

  /** Sin el filtro de estado: un chip no puede contar el subconjunto que él mismo produce. */
  conteos(query: TramiteListQuery): Observable<TramiteConteos> {
    return this.tramites.getAll(this.toFilter({ ...query, estado: '' })).pipe(
      map((res) => ({
        todos: res.data.length,
        publicado: res.data.filter((t) => t.estado === 'publicado').length,
        revision: res.data.filter((t) => t.estado === 'revision').length,
      })),
    );
  }

  getById(id: string): Observable<TramiteVM> {
    return this.tramites.getById(id).pipe(map(toTramiteVM));
  }

  create(form: TramiteFormValue): Observable<TramiteVM> {
    return this.tramites.create(toTramiteCreateDTO(form)).pipe(map(toTramiteVM));
  }

  update(id: string, form: TramiteFormValue): Observable<TramiteVM> {
    return this.tramites.update(id, toTramiteCreateDTO(form)).pipe(map(toTramiteVM));
  }

  delete(id: string): Observable<void> {
    return this.tramites.delete(id);
  }

  /**
   * El endpoint de feedback no agrega por trámite, así que se pide una página y se cuenta
   * acá. Los conteos se derivan de lo efectivamente recibido —no de `res.total`— para que
   * útiles + no útiles siempre cierre: si algún día hay más valoraciones que las que entran
   * en la página, un total mayor y un desglose de la muestra se contradirían en pantalla.
   */
  getFeedbackResumen(tramiteId: string): Observable<FeedbackResumenVM> {
    return this.feedback.getAll({ tramiteId, pageSize: FEEDBACK_PAGINA }).pipe(
      map((res) => {
        const contadas = res.data.length;
        const utiles = res.data.filter((f) => f.esUtil).length;
        return {
          total: contadas,
          utiles,
          noUtiles: contadas - utiles,
          porcentajeUtil: contadas > 0 ? Math.round((utiles / contadas) * 100) : 0,
          ultimas: [...res.data]
            .sort((a, b) => (b.fechaFeedback ?? '').localeCompare(a.fechaFeedback ?? ''))
            .slice(0, FEEDBACK_MUESTRA)
            .map((f) => ({
              id: f.id,
              esUtil: f.esUtil,
              comentario: f.comentario,
              fecha: f.fechaFeedback,
            })),
        };
      }),
    );
  }

  sendToReview(id: string): Observable<TramiteVM> {
    return this.tramites.sendToReview(id).pipe(map(toTramiteVM));
  }

  publish(id: string): Observable<TramiteVM> {
    return this.tramites.publish(id).pipe(map(toTramiteVM));
  }

  unpublish(id: string): Observable<TramiteVM> {
    return this.tramites.unpublish(id).pipe(map(toTramiteVM));
  }

  listContenidoLocalidad(tramiteId: string): Observable<ContenidoLocalidadVM[]> {
    return this.tramites.getContenidoLocalidades(tramiteId).pipe(
      map((items) => items.map(toContenidoLocalidadVM)),
    );
  }

  addContenidoLocalidad(tramiteId: string, form: ContenidoLocalidadFormValue): Observable<ContenidoLocalidadVM> {
    return this.tramites.addContenidoLocalidad(tramiteId, toContenidoLocalidadDTO(form))
      .pipe(map(toContenidoLocalidadVM));
  }

  updateContenidoLocalidad(tramiteId: string, localidadId: number, form: ContenidoLocalidadFormValue): Observable<ContenidoLocalidadVM> {
    return this.tramites.updateContenidoLocalidad(tramiteId, localidadId, toContenidoLocalidadDTO(form))
      .pipe(map(toContenidoLocalidadVM));
  }

  removeContenidoLocalidad(tramiteId: string, localidadId: number): Observable<void> {
    return this.tramites.removeContenidoLocalidad(tramiteId, localidadId);
  }

  private toFilter(query: TramiteListQuery): TramiteFilter {
    return {
      search: query.search || undefined,
      organismoId: query.organismoId || undefined,
      estado: query.estado || undefined,
      localidadId: query.localidadId || undefined,
      page: 1,
      pageSize: TRAER_TODO,
    };
  }

  private ordenar(rows: TramiteVM[], sortBy?: string, sortDir?: 'asc' | 'desc' | ''): TramiteVM[] {
    if (!sortBy || !sortDir) return rows;
    const factor = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) =>
      this.valorDeOrden(a, sortBy).localeCompare(this.valorDeOrden(b, sortBy), 'es-AR', { sensitivity: 'base' }) * factor,
    );
  }

  private valorDeOrden(tramite: TramiteVM, key: string): string {
    switch (key) {
      case 'titulo':    return tramite.titulo ?? '';
      case 'estado':    return tramite.estado ?? '';
      case 'modalidad': return tramite.modalidadNombre ?? '';
      // ISO 8601 ordena bien como texto, así que no hace falta parsear a Date.
      case 'updatedAt': return tramite.updatedAt ?? '';
      default:          return '';
    }
  }
}
