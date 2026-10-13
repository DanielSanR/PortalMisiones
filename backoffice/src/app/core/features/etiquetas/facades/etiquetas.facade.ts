import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, forkJoin, map, of, tap } from 'rxjs';
import { OrganismoOption, OrganismosRepository } from '@features/organismos';
import { EtiquetasRepository } from '../repositories/etiquetas.repository';
import { EtiquetaFormData, EtiquetaFormValue, EtiquetaVM } from '../models/etiqueta.vm';

/**
 * Facade de Etiquetas (`/api/tag` real o mock según `featureOverrides`). Expone Observables
 * (async pipe; NO signals). Depende solo de repositorios; el cruce con organismos es vía su
 * Repository (patrón sancionado, igual que `UsuariosFacade`).
 */
@Injectable({ providedIn: 'root' })
export class EtiquetasFacade {
  private readonly _etiquetas$ = new BehaviorSubject<EtiquetaVM[]>([]);
  readonly etiquetas$ = this._etiquetas$.asObservable();

  /** Último catálogo de organismos resuelto, para nombrar el organismo tras crear/editar. */
  private nombresOrganismo = new Map<string, string>();

  constructor(
    private etiquetas: EtiquetasRepository,
    private organismos: OrganismosRepository,
  ) {}

  /** Carga la lista con el nombre de organismo ya resuelto y la publica en el stream. */
  loadEtiquetas(): Observable<EtiquetaVM[]> {
    return forkJoin({ lista: this.etiquetas.list(), organismos: this.opcionesOrganismo() }).pipe(
      map(({ lista }) => lista.map((e) => this.conNombreOrganismo(e))),
      tap((list) => this._etiquetas$.next(list)),
    );
  }

  /** Etiqueta en edición (o null en alta) + opciones de organismo, en una sola llamada. */
  getFormData(id: string | null): Observable<EtiquetaFormData> {
    return forkJoin({
      etiqueta: id ? this.etiquetas.getById(id) : of(null),
      organismos: this.opcionesOrganismo(),
    }).pipe(
      map(({ etiqueta, organismos }) => ({
        etiqueta: etiqueta ? this.conNombreOrganismo(etiqueta) : null,
        organismos,
      })),
    );
  }

  create(form: EtiquetaFormValue): Observable<EtiquetaVM> {
    return this.etiquetas.create(form).pipe(
      map((e) => this.conNombreOrganismo(e)),
      tap((e) => this._etiquetas$.next([...this._etiquetas$.value, e])),
    );
  }

  update(id: string, form: EtiquetaFormValue): Observable<EtiquetaVM> {
    return this.etiquetas.update(id, form).pipe(
      map((e) => this.conNombreOrganismo(e)),
      tap((updated) => this._etiquetas$.next(this._etiquetas$.value.map((e) => (e.id === id ? updated : e)))),
    );
  }

  delete(id: string): Observable<void> {
    return this.etiquetas.delete(id).pipe(
      tap(() => this._etiquetas$.next(this._etiquetas$.value.filter((e) => e.id !== id))),
    );
  }

  /**
   * Opciones de organismo, degradadas a `[]` si fallan (p. ej. el usuario no tiene
   * `READ_ORGANISM`): la lista muestra "—" y el form sigue permitiendo etiquetas globales.
   * Cachea los nombres para resolver `organismoNombre` sin volver a pedir el catálogo.
   */
  private opcionesOrganismo(): Observable<OrganismoOption[]> {
    return this.organismos.getOptions().pipe(
      catchError(() => of([] as OrganismoOption[])),
      tap((opciones) => { this.nombresOrganismo = new Map(opciones.map((o) => [o.id, o.nombre])); }),
    );
  }

  private conNombreOrganismo(e: EtiquetaVM): EtiquetaVM {
    return {
      ...e,
      organismoNombre: e.organismoId ? this.nombresOrganismo.get(e.organismoId) ?? null : null,
    };
  }
}
