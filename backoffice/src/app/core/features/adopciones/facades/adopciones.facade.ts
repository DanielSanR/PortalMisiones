import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, Observable, catchError, defer, distinctUntilChanged, forkJoin, map, of, shareReplay, skip, switchMap, tap,
} from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { ADOPTAR_ACCESS } from '@core/constants/policy-overrides.constants';
import { PlantillasRepository } from '@features/plantillas';
import { OrganismosRepository } from '@features/organismos';
import { AdopcionesRepository } from '../repositories/adopciones.repository';
import {
  Adopcion, AdopcionFormValue, AdopcionOpcion, AdopcionOpciones, AdopcionVM,
} from '../models/adopcion.vm';
import { estadoDeVigencia } from '../models/vigencia';

/** Permisos que exige leer cada catálogo de nombres en el backend. */
const LEER_PLANTILLAS = 'READ_PROCEDURE';
const LEER_ORGANISMOS = 'READ_ORGANISM';

/** Nombres para resolver los ids de una adopción. Un mapa vacío = no se pudo (o no se puede) leer. */
interface Nombres {
  plantillas: Map<string, string>;
  organismos: Map<string, string>;
  /** Algún catálogo falló (no por falta de permiso): no se cachea, para reintentar en el próximo uso. */
  degradado: boolean;
}

/**
 * Facade de adopciones — "Trámites del organismo" (`/api/organism-procedure` real o mock según
 * `featureOverrides`). Expone Observables (async pipe; NO signals). Depende solo de repositorios: el
 * propio y, para los nombres que el backend no devuelve, los de plantillas y organismos (vía su barrel,
 * nunca sus facades).
 *
 * Los nombres degradan a `null` en vez de tumbar la pantalla:
 * - Sin `READ_ORGANISM` (AB, AO) ni siquiera se pide `/api/organism` (respondería 403 y su datasource
 *   abriría el diálogo global): el organismo queda sin nombre.
 * - Sin `READ_PROCEDURE` (AO, por G-3) tampoco se piden las plantillas.
 * La sesión se consulta en `AuthTokenService` (infra de sesión, fuera del patrón de features) en cada
 * llamada, no al construir: el facade es singleton y los permisos pueden cambiar.
 *
 * `vigente`/`estadoVigencia` se calculan con la fecha actual en cada lectura.
 */
@Injectable({ providedIn: 'root' })
export class AdopcionesFacade {
  private readonly _adopciones$ = new BehaviorSubject<AdopcionVM[]>([]);
  /** Solo las habilitadas: el backend no lista las deshabilitadas (decisión P-4: no se muestran). */
  readonly adopciones$ = this._adopciones$.asObservable();

  private nombresCache$: Observable<Nombres> | null = null;
  /** Permisos con los que se armó la caché: si la sesión cambia (otro rol, refresh), se rearma. */
  private nombresClave = '';
  /** Títulos de plantillas que no vienen en el listado (desactivadas), leídos de a una con `GET /{id}`. */
  private readonly titulosSueltos = new Map<string, string>();

  constructor(
    private adopciones: AdopcionesRepository,
    private plantillas: PlantillasRepository,
    private organismos: OrganismosRepository,
    private auth: AuthTokenService,
  ) {
    // Cambio de sesión (logout/login, otro usuario): nada de lo leído con la sesión anterior sirve.
    // Singleton `root`: vive lo mismo que el injector raíz, y se corta con él (`takeUntilDestroyed`).
    this.auth.getCurrentUser$()
      .pipe(map((usuario) => usuario?.id ?? null), distinctUntilChanged(), skip(1), takeUntilDestroyed())
      .subscribe(() => {
        this.nombresCache$ = null;
        this.nombresClave = '';
        this.titulosSueltos.clear();
        this._adopciones$.next([]);
      });
  }

  /**
   * Carga el listado con los nombres resueltos y lo publica en `adopciones$`. Vacía el stream al
   * empezar (singleton: si no, mientras carga o si falla se verían filas viejas) y refresca los nombres.
   */
  loadAdopciones(): Observable<AdopcionVM[]> {
    return defer(() => {
      this._adopciones$.next([]);
      return this.adopciones.list();
    }).pipe(
      switchMap((lista) => this.aVMs(lista, true)),
      tap((lista) => this._adopciones$.next(lista)),
    );
  }

  /** Una adopción (habilitada o no) con los nombres resueltos. */
  getDetalle(id: string): Observable<AdopcionVM> {
    return this.adopciones.getById(id).pipe(
      switchMap((adopcion) => this.aVMs([adopcion])),
      map(([vm]) => vm),
    );
  }

  /**
   * Adopciones (habilitadas) de una plantilla, para "Organismos que la adoptaron". El backend no filtra
   * por plantilla: se pide el listado completo del alcance y se filtra acá. No toca `adopciones$`.
   */
  getDePlantilla(plantillaId: string): Observable<AdopcionVM[]> {
    return this.adopciones.list().pipe(
      map((lista) => lista.filter((a) => a.plantillaId === plantillaId)),
      switchMap((lista) => this.aVMs(lista)),
    );
  }

  /**
   * Opciones del diálogo "Adoptar trámite": plantillas activas (el backend solo lista esas, y solo esas
   * se pueden adoptar) y organismos activos. A diferencia de los nombres, acá un error NO se degrada:
   * el diálogo no sirve sin opciones y muestra su estado de error con "Reintentar".
   */
  getOpcionesAdoptar(): Observable<AdopcionOpciones> {
    return forkJoin({
      plantillas: this.plantillas.list().pipe(
        map((lista) => ordenar(lista.filter((p) => p.activa).map((p) => ({ id: p.id, nombre: p.titulo })))),
      ),
      organismos: this.auth.can(LEER_ORGANISMOS)
        ? this.organismos.getOptions().pipe(map(ordenar))
        : of([] as AdopcionOpcion[]),
    });
  }

  /**
   * ¿Puede abrir "Adoptar trámite"? (`ADOPTAR_ACCESS`, decisión P-2). Lo usa el listado para abrir el
   * diálogo desde el buscador de comandos (`?adoptar=1`); el botón se gatea con `*appHasPermission`.
   */
  puedeAdoptar(): boolean {
    return this.auth.canAccess(ADOPTAR_ACCESS);
  }

  adoptar(form: AdopcionFormValue): Observable<AdopcionVM> {
    return this.adopciones.create(form).pipe(
      switchMap((adopcion) => this.aVMs([adopcion])),
      map(([vm]) => vm),
      tap((creada) => {
        if (creada.habilitada) this._adopciones$.next([...this._adopciones$.value, creada]);
      }),
    );
  }

  update(id: string, form: AdopcionFormValue): Observable<AdopcionVM> {
    return this.adopciones.update(id, form).pipe(
      switchMap((adopcion) => this.aVMs([adopcion])),
      map(([vm]) => vm),
      tap((actualizada) => {
        const resto = this._adopciones$.value.filter((a) => a.id !== id);
        // Deshabilitarla desde la edición la saca del listado (el backend ya no la devuelve);
        // rehabilitarla la vuelve a poner.
        if (!actualizada.habilitada) {
          this._adopciones$.next(resto);
          return;
        }
        const existia = resto.length !== this._adopciones$.value.length;
        this._adopciones$.next(existia
          ? this._adopciones$.value.map((a) => (a.id === id ? actualizada : a))
          : [...resto, actualizada]);
      }),
    );
  }

  /** Borrado lógico (`enabled=false`): deja de listarse. */
  deshabilitar(id: string): Observable<void> {
    return this.adopciones.deshabilitar(id).pipe(
      tap(() => this._adopciones$.next(this._adopciones$.value.filter((a) => a.id !== id))),
    );
  }

  /** Completa nombres y vigencia. Los títulos que faltan (plantillas desactivadas) se piden de a uno. */
  private aVMs(lista: Adopcion[], refrescar = false): Observable<AdopcionVM[]> {
    if (!lista.length) return of([]);
    return this.nombres(refrescar).pipe(
      switchMap((nombres) => this.completarTitulos(lista, nombres)),
      map((nombres) => {
        const ahora = new Date();
        return lista.map((a): AdopcionVM => {
          const estadoVigencia = estadoDeVigencia(a.vigenteDesde, a.vigenteHasta, ahora);
          return {
            ...a,
            plantillaTitulo: nombres.plantillas.get(a.plantillaId) ?? this.titulosSueltos.get(a.plantillaId) ?? null,
            organismoNombre: nombres.organismos.get(a.organismoId) ?? null,
            vigente: estadoVigencia === 'vigente',
            estadoVigencia,
          };
        });
      }),
    );
  }

  /**
   * El listado de plantillas solo trae las activas: una adopción de una plantilla desactivada quedaría
   * sin título. Esas se leen con `GET /{id}` (que también devuelve las inactivas) y se recuerdan.
   */
  private completarTitulos(lista: Adopcion[], nombres: Nombres): Observable<Nombres> {
    if (!this.auth.can(LEER_PLANTILLAS)) return of(nombres);
    const faltan = [...new Set(lista.map((a) => a.plantillaId))]
      .filter((id) => !nombres.plantillas.has(id) && !this.titulosSueltos.has(id));
    if (!faltan.length) return of(nombres);
    return forkJoin(faltan.map((id) => this.plantillas.getById(id).pipe(
      tap((p) => this.titulosSueltos.set(p.id, p.titulo)),
      catchError(() => of(null)),
    ))).pipe(map(() => nombres));
  }

  private nombres(refrescar = false): Observable<Nombres> {
    const clave = `${this.auth.can(LEER_PLANTILLAS)}|${this.auth.can(LEER_ORGANISMOS)}`;
    if (clave !== this.nombresClave) {
      this.nombresClave = clave;
      this.titulosSueltos.clear();
      refrescar = true;
    }
    if (!this.nombresCache$ || refrescar) {
      const cache$: Observable<Nombres> = forkJoin({
        plantillas: this.leer(LEER_PLANTILLAS, () => this.plantillas.list().pipe(
          map((lista) => lista.map((p) => ({ id: p.id, nombre: p.titulo }))),
        )),
        // `list()` y no `getOptions()`: también hay que nombrar organismos desactivados.
        organismos: this.leer(LEER_ORGANISMOS, () => this.organismos.list().pipe(
          map((lista) => lista.map((o) => ({ id: o.id, nombre: o.nombre }))),
        )),
      }).pipe(
        map(({ plantillas, organismos }): Nombres => ({
          plantillas: plantillas.mapa,
          organismos: organismos.mapa,
          degradado: plantillas.fallo || organismos.fallo,
        })),
        tap((nombres) => {
          // Solo se invalida a sí misma: una lectura vieja que termina tarde no borra una más nueva.
          if (nombres.degradado && this.nombresCache$ === cache$) this.nombresCache$ = null;
        }),
        shareReplay(1),
      );
      this.nombresCache$ = cache$;
    }
    return this.nombresCache$;
  }

  /** Lee un catálogo de nombres si hay permiso; si falla, queda vacío y lo anota. */
  private leer(
    permiso: string,
    fuente: () => Observable<AdopcionOpcion[]>,
  ): Observable<{ mapa: Map<string, string>; fallo: boolean }> {
    if (!this.auth.can(permiso)) return of({ mapa: new Map<string, string>(), fallo: false });
    return fuente().pipe(
      map((opciones) => ({ mapa: new Map(opciones.map((o) => [o.id, o.nombre])), fallo: false })),
      catchError(() => of({ mapa: new Map<string, string>(), fallo: true })),
    );
  }
}

function ordenar(opciones: AdopcionOpcion[]): AdopcionOpcion[] {
  return [...opciones].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR', { sensitivity: 'base' }));
}
