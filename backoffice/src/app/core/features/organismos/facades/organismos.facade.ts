import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin, map, of, tap } from 'rxjs';
import { TiposOrganismoRepository } from '@features/tipos-organismo';
import { LocalidadesRepository } from '@features/localidades';
import { OrganismosRepository } from '../repositories/organismos.repository';
import { OrganismoFormData, OrganismoFormValue, OrganismoVM } from '../models/organismo.vm';

/**
 * Facade de Organismos. Expone Observables (async pipe; NO signals). Depende de su Repository y,
 * cross-feature, del `TiposOrganismoRepository` (nunca de su facade) para resolver el nombre del tipo.
 */
@Injectable({ providedIn: 'root' })
export class OrganismosFacade {
  private readonly _organismos$ = new BehaviorSubject<OrganismoVM[]>([]);
  readonly organismos$ = this._organismos$.asObservable();

  /** Mapa typeId→nombre, cacheado en cada carga para resolver `tipoNombre` en los ABM. */
  private tiposMap = new Map<string, string>();

  constructor(
    private repo: OrganismosRepository,
    private tiposRepo: TiposOrganismoRepository,
    private localidadesRepo: LocalidadesRepository,
  ) {}

  /** Orquesta los datos del formulario (tipos + localidades + organismos padre + organismo en edición). */
  getFormData(id?: string): Observable<OrganismoFormData> {
    return forkJoin({
      tipos: this.tiposRepo.getOptions(),
      localidades: this.localidadesRepo.getLocalidades().pipe(
        map((ls) => ls.map((l) => ({ id: l.id, nombre: `${l.nombre} (${l.departamentoNombre})` })))
      ),
      // VMs completos (no `getOptions()`): el form necesita `parentId` para excluir descendientes.
      // Mismo costo de red — `getOptions()` también resuelve sobre `ds.list()`.
      organismos: this.repo.list(),
      organismo: id ? this.repo.getById(id) : of(null),
    });
  }

  /** Carga organismos + tipos y resuelve `tipoNombre` (el DTO solo trae `typeId`). */
  loadOrganismos(): Observable<OrganismoVM[]> {
    return forkJoin({ orgs: this.repo.list(), tipos: this.tiposRepo.getOptions() }).pipe(
      map(({ orgs, tipos }) => {
        this.tiposMap = new Map(tipos.map((t) => [t.id, t.nombre]));
        return orgs.map((o) => ({ ...o, tipoNombre: this.tiposMap.get(o.typeId) }));
      }),
      tap((list) => this._organismos$.next(list)),
    );
  }

  getById(id: string): Observable<OrganismoVM> {
    return this.repo.getById(id);
  }

  create(form: OrganismoFormValue): Observable<OrganismoVM> {
    return this.repo.create(form).pipe(
      tap((o) => this._organismos$.next([...this._organismos$.value, this.withTipo(o)]))
    );
  }

  update(id: string, form: OrganismoFormValue): Observable<OrganismoVM> {
    return this.repo.update(id, form).pipe(
      tap((updated) =>
        this._organismos$.next(this._organismos$.value.map((o) => (o.id === id ? this.withTipo(updated) : o)))
      )
    );
  }

  delete(id: string): Observable<void> {
    return this.repo.delete(id).pipe(
      tap(() => this._organismos$.next(this._organismos$.value.filter((o) => o.id !== id)))
    );
  }

  private withTipo(o: OrganismoVM): OrganismoVM {
    return { ...o, tipoNombre: this.tiposMap.get(o.typeId) };
  }
}
