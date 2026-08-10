import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, map, catchError } from 'rxjs';
import { OrganismosRepository } from '@features/organismos';
import { TiposOrganismoRepository } from '@features/tipos-organismo';
import { CategoriasRepository } from '@features/categorias';
import { ModalidadesRepository } from '@features/modalidades';
import { EventosDeVidaRepository } from '@features/eventos-de-vida';
import { DestinatariosRepository } from '@features/destinatarios';
import { RolesRepository } from '@features/roles';
import { PermisosRepository } from '@features/permisos';
import { CatalogCounts, CatalogKey } from '../models/dashboard.vm';

/**
 * Facade de Dashboard — SOLO orquesta los conteos reales de catálogo (P3 del Home,
 * HOME_REDISENO.md §3/§5), leyendo el `length` de cada lista vía el **REPOSITORY** de cada feature
 * dueño (nunca su facade — regla de capas, `facade → facade` prohibido). El resto del Home (cola de
 * revisión, pipeline, analítica, feedback, actividad) no tiene backend real todavía: vive como
 * datos estáticos ("Datos de ejemplo") directamente en `DashboardComponent`, este facade no los toca.
 */
@Injectable({ providedIn: 'root' })
export class DashboardFacade {
  constructor(
    private organismos: OrganismosRepository,
    private tiposOrganismo: TiposOrganismoRepository,
    private categorias: CategoriasRepository,
    private modalidades: ModalidadesRepository,
    private eventos: EventosDeVidaRepository,
    private destinatarios: DestinatariosRepository,
    private roles: RolesRepository,
    private permisos: PermisosRepository
  ) {}

  private readonly countSource: Record<CatalogKey, () => Observable<number>> = {
    organismos: () => this.organismos.list().pipe(map((list) => list.length)),
    tiposOrganismo: () => this.tiposOrganismo.list().pipe(map((list) => list.length)),
    categorias: () => this.categorias.list().pipe(map((list) => list.length)),
    modalidades: () => this.modalidades.list().pipe(map((list) => list.length)),
    eventos: () => this.eventos.list().pipe(map((list) => list.length)),
    destinatarios: () => this.destinatarios.list().pipe(map((list) => list.length)),
    roles: () => this.roles.list().pipe(map((list) => list.length)),
    permisos: () => this.permisos.list().pipe(map((list) => list.length)),
  };

  /**
   * Cuenta SOLO los catálogos de `keys`. El gating por permiso lo decide el LLAMANTE (el
   * componente filtra `keys` con `AuthTokenService.can(...)` antes de invocar esto): así nunca se
   * dispara un GET que el usuario no puede leer. Cada fuente se aísla con `catchError` para que un
   * catálogo caído no tumbe el `forkJoin` de los demás.
   */
  loadCatalogCounts(keys: CatalogKey[]): Observable<CatalogCounts> {
    if (keys.length === 0) return of({});

    const sources = keys.reduce<Record<string, Observable<number | null>>>((acc, key) => {
      acc[key] = this.countSource[key]().pipe(catchError(() => of(null)));
      return acc;
    }, {});

    return forkJoin(sources).pipe(
      map((result) => {
        const counts: CatalogCounts = {};
        for (const key of keys) {
          const value = result[key];
          if (value !== null && value !== undefined) counts[key] = value;
        }
        return counts;
      })
    );
  }
}
