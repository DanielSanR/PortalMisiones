import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, Observable, catchError, concatMap, throwError, defer, distinctUntilChanged, forkJoin, from, last, map,
  of, shareReplay, skip, switchMap, tap,
} from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { PUBLICACION_POLICY } from '@core/constants/policy-overrides.constants';
import { leerDeAUno } from '@core/utils/lecturas-de-a-una.utils';
import { AdopcionesRepository } from '@features/adopciones';
import { PlantillasRepository } from '@features/plantillas';
import { OrganismosRepository } from '@features/organismos';
import { LocalidadesRepository } from '@features/localidades';
import { FichasLocalesRepository } from '../repositories/fichas-locales.repository';
import {
  FichaAdopcionResumen, FichaBase, FichaFormData, FichaGuardada, FichaLocal, FichaLocalFormValue, FichaLocalVM,
  FichasDeAdopcion, MotivoNoVigente,
} from '../models/ficha-local.vm';
import { DespublicacionFallidaError, FichaCambiadaError, FichaSinContenidoError } from '../domain/ficha-errores';
import {
  cambioDesdeLaBase, fichasOcupadas, opcionesDeLocalidad, quedoPublicadaEInactiva, trasDesactivar,
} from '../domain/ficha-guardado';
import {
  AdopcionDeFicha, CatalogosDeFichas, LecturaDeCatalogo, LecturasSueltas, adopcionesElegibles, adopcionesSinLeer,
  catalogosDe, esLecturaDefinitiva, nombreDePlantilla, plantillasSinLeer, resolverNombres, resumenDeAdopcion, soloDeLaAdopcion,
} from '../domain/nombres-de-ficha';
import { AccionWorkflow, TRANSICIONES_DE_ACCION, accionesDisponibles } from '../domain/workflow';
import { motivoNoVigente } from '../domain/vigencia-adopcion';

/** Permisos que exige leer cada catálogo de nombres en el backend. Las localidades son públicas. */
const LEER_ADOPCIONES = 'READ_ADOPTION';
const LEER_PLANTILLAS = 'READ_PROCEDURE';
const LEER_ORGANISMOS = 'READ_ORGANISM';
/** Permiso de publicar/despublicar (D-3: decide el permiso, nunca el rol). */
const PUBLICAR = 'PUBLISH_VARIANT';

/** Acciones de workflow que se ofrecen para una ficha con la sesión vigente. */
export type ResolverAccionesWorkflow = (ficha: Pick<FichaLocalVM, 'estado' | 'activa'>) => AccionWorkflow[];

/**
 * Facade de fichas por localidad (`/api/organism-procedure-location`, real o mock según `featureOverrides`) y de
 * su workflow de publicación. Observables (async pipe; NO signals). Depende solo de repositorios: el propio y, para
 * los nombres que el backend no devuelve, los de adopciones, plantillas, organismos y localidades (vía su barrel).
 * Acá queda la orquestación (lecturas, caché, permisos); las reglas puras, en `domain/`. Los nombres degradan a
 * `null` en vez de tumbar la pantalla. Excepción de sesión (`.claude/rules/arquitectura-capas.md`): `AuthTokenService`
 * se consulta SOLO para no pedir un catálogo sin permiso de lectura — AGENT tiene `READ_ADOPTION` (R-3) pero no
 * `READ_PROCEDURE` (G-3), y solo SA tiene `READ_ORGANISM`: pedirlos abriría 403 — y para exponer lo que ofrece el
 * workflow (`puedePublicar$`, `accionesWorkflow$`: `accionesDisponibles` + `PUBLICACION_POLICY`). Siempre por permiso.
 */
@Injectable({ providedIn: 'root' })
export class FichasLocalesFacade {
  private readonly _fichas$ = new BehaviorSubject<FichaLocalVM[]>([]);
  /** Todas las fichas del alcance, activas e inactivas (el backend lista las dos). */
  readonly fichas$ = this._fichas$.asObservable();

  /** ¿Puede publicar (`PUBLISH_VARIANT`)? Reactivo a la sesión: la bandeja "En revisión" es suya. */
  readonly puedePublicar$: Observable<boolean>;

  /** Acciones de workflow de una ficha según estado, `activa` y permisos; se re-emite con cada cambio de sesión. */
  readonly accionesWorkflow$: Observable<ResolverAccionesWorkflow>;

  /** ¿Datos simulados (no se guardan en el servidor)? Lo decide la fuente (hoy, el todo-mock de `ng serve`); la UI lo avisa. */
  get fuenteSimulada(): boolean {
    return this.fichas.fuenteSimulada;
  }

  private contextoCache$: Observable<CatalogosDeFichas> | null = null;
  /** Permisos con los que se armó la caché: si la sesión cambia (otro rol, refresh), se rearma. */
  private contextoClave = '';
  /**
   * Adopciones deshabilitadas y plantillas desactivadas (no vienen en los listados), leídas de a una y recordadas
   * por id hasta que cambie la sesión o sus permisos: recargar el listado no las vuelve a pedir. La lectura de
   * UNA ficha (`getDetalle`) sí vuelve a pedir su adopción, para que el aviso de vigencia no salga de un dato viejo.
   */
  private readonly sueltas: LecturasSueltas = { adopciones: new Map(), plantillas: new Map() };
  /** Sube con cada invalidación: una lectura suelta que termina tarde no se guarda en la caché de otra sesión. */
  private generacion = 0;

  constructor(
    private fichas: FichasLocalesRepository,
    private adopciones: AdopcionesRepository,
    private plantillas: PlantillasRepository,
    private organismos: OrganismosRepository,
    private localidades: LocalidadesRepository,
    private auth: AuthTokenService,
  ) {
    this.puedePublicar$ = this.auth.getCurrentUser$().pipe(map(() => this.auth.can(PUBLICAR)), distinctUntilChanged());
    this.accionesWorkflow$ = this.auth.getCurrentUser$().pipe(
      map((): ResolverAccionesWorkflow => (ficha) => accionesDisponibles(ficha.estado, (p) => this.auth.can(p), {
        activa: ficha.activa,
        permitirEnviarYPublicar: PUBLICACION_POLICY.permitirEnviarYPublicar,
      })),
    );

    // Cambio de sesión (logout/login, otro usuario): nada de lo leído con la sesión anterior sirve.
    // Singleton `root`: la suscripción vive lo mismo que la app.
    this.auth.getCurrentUser$()
      .pipe(map((usuario) => usuario?.id ?? null), distinctUntilChanged(), skip(1), takeUntilDestroyed())
      .subscribe(() => {
        this.invalidarContexto();
        this._fichas$.next([]);
      });
  }

  /**
   * Carga el listado con los nombres resueltos (refrescados) y lo publica en `fichas$`. Vacía el stream al
   * empezar: el facade es singleton y, si no, mientras carga o si falla se verían filas viejas.
   */
  loadFichas(): Observable<FichaLocalVM[]> {
    return defer(() => {
      this._fichas$.next([]);
      return this.fichas.list();
    }).pipe(
      switchMap((lista) => this.aVMs(lista, true)),
      tap((lista) => this._fichas$.next(lista)),
    );
  }

  /**
   * Una ficha (activa o no) con los nombres resueltos, para una PANTALLA (detalle, form de edición): la vigencia de
   * su adopción (`adopcionNoVigente`) sale de datos recién leídos, no de la caché de la sesión (si no, un cambio en
   * "Trámites del organismo" no se vería hasta cerrar sesión). Cuesta releer los catálogos y un `GET` de la adopción.
   */
  getDetalle(id: string): Observable<FichaLocalVM> {
    return this.fichas.getById(id).pipe(switchMap((ficha) => this.aVM(ficha, true)));
  }

  /**
   * Fichas (activas e inactivas) de una adopción, para el detalle del trámite del organismo: las filtra la
   * fuente (`?organismProcedureId=`) y se vuelven a filtrar acá (`soloDeLaAdopcion`, que explica por qué y qué
   * es `sinContenido`). Además dice si hoy se le pueden agregar fichas (el backend solo lo acepta con la
   * adopción vigente); si la adopción no se puede leer, eso queda sin decidir (`null`) y la lista se muestra
   * igual. No toca `fichas$`.
   */
  getDeAdopcion(adopcionId: string): Observable<FichasDeAdopcion> {
    const motivo$: Observable<MotivoNoVigente | null> = !this.auth.can(LEER_ADOPCIONES) ? of(null)
      : this.adopciones.getById(adopcionId).pipe(map((a) => motivoNoVigente(a, new Date())), catchError(() => of(null)));
    return forkJoin({
      leidas: this.fichas.list({ adopcionId }).pipe(
        map((lista) => soloDeLaAdopcion(lista, adopcionId)),
        switchMap(({ propias, sinContenido }) => this.aVMs(propias).pipe(map((fichas) => ({ fichas, sinContenido })))),
      ),
      motivoNoVigente: motivo$,
    }).pipe(map(({ leidas, motivoNoVigente: motivo }) => ({ ...leidas, motivoNoVigente: motivo })));
  }

  /**
   * Todo lo que necesita el form: la ficha (en edición), su adopción (título y `slugBase` para el slug sugerido,
   * P-5), las localidades y lo ya ocupado (`fichasOcupadas`). En alta, que la adopción no exista es un error; en
   * edición, no poder leerla solo deja los nombres sin resolver. Se pide el listado completo del alcance (sin
   * `?organismProcedureId=`): los slugs se validan contra TODAS las fichas visibles. La vigencia sale siempre de
   * una lectura nueva: la de la ficha por `getDetalle` y la del resumen por `GET /{id}` de la adopción.
   */
  getFormData(fichaId: string | null, adopcionId: string | null): Observable<FichaFormData> {
    const ficha$: Observable<FichaLocalVM | null> = fichaId ? this.getDetalle(fichaId) : of(null);
    return ficha$.pipe(
      switchMap((ficha) => {
        const idAdopcion = ficha ? ficha.adopcionId : adopcionId;
        return forkJoin({
          adopcion: idAdopcion ? this.resumenAdopcion(idAdopcion, !ficha) : of(null),
          localidades: this.localidades.getLocalidades(),
          todas: this.fichas.list(),
        }).pipe(
          map(({ adopcion, localidades, todas }): FichaFormData => ({
            ficha,
            adopcion,
            localidades: opcionesDeLocalidad(localidades),
            ocupadas: fichasOcupadas(todas, ficha?.id ?? null, idAdopcion),
          })),
        );
      }),
    );
  }

  /**
   * Adopciones habilitadas, con nombres y vigencia: lo que el alta sin `?adopcion=` deja elegir (`adopcionesElegibles`).
   * Sin `READ_ADOPTION` devuelve `[]` (el alta tampoco se ofrece: `CREAR_FICHA_ACCESS`). Relee los catálogos (no
   * usa la caché): lo que se acaba de adoptar tiene que aparecer.
   */
  getAdopcionesParaFicha(): Observable<FichaAdopcionResumen[]> {
    if (!this.auth.can(LEER_ADOPCIONES)) return of([]);
    return this.contexto(true).pipe(map((contexto) => adopcionesElegibles(contexto, new Date())));
  }

  /** Alta: queda en `BORRADOR`, versión 1. */
  create(form: FichaLocalFormValue): Observable<FichaLocalVM> {
    return this.fichas.create(form).pipe(
      switchMap((ficha) => this.aVM(ficha)),
      tap((creada) => this._fichas$.next([...this._fichas$.value, creada])),
    );
  }

  /**
   * Edición (PUT total sobre lo que devolvió el `GET`). Guardar no cambia el estado de publicación: el backend
   * lo conserva. Hay una excepción, y el resultado la informa (`despublicada`): si la ficha queda `PUBLICADO` e
   * inactiva (`quedoPublicadaEInactiva`), se completa con el `DELETE` y se relee. Si ese segundo paso falla, el
   * error es `DespublicacionFallidaError` (los cambios SÍ se guardaron), no un error de guardado.
   * `base` (lo que el form leyó): se relee la ficha justo antes del PUT y, si cambió (`cambioDesdeLaBase`), no
   * se guarda: `FichaCambiadaError` con la ficha actual. Sin `base` no se compara. COMPATIBILIDAD TEMPORAL: sin
   * adopción o localidad (ficha `sinContenido`, backend anterior a `586b670`) no se envía nada: `FichaSinContenidoError`.
   */
  update(id: string, form: FichaLocalFormValue, base?: FichaBase): Observable<FichaGuardada> {
    if (!form.adopcionId || !form.localidadId) return throwError(() => new FichaSinContenidoError());
    return this.verificarBase(id, base).pipe(
      switchMap(() => this.fichas.update(id, form)),
      switchMap((guardada): Observable<{ ficha: FichaLocal; despublicada: boolean }> => {
        if (!quedoPublicadaEInactiva(guardada)) return of({ ficha: guardada, despublicada: false });
        return this.fichas.desactivar(id).pipe(
          // Solo el `DELETE`: si falla, el PUT ya está persistido y la lista tiene que reflejarlo.
          catchError(() => this.aVM(guardada).pipe(
            tap((vm) => this.reemplazar(vm)),
            switchMap((vm) => throwError(() => new DespublicacionFallidaError(vm))),
          )),
          // El `DELETE` salió bien: si la relectura falla, vale la regla del backend (publicada → despublicada).
          switchMap(() => this.fichas.getById(id).pipe(
            catchError(() => of<FichaLocal>({ ...guardada, estado: 'DESPUBLICADO' })),
          )),
          map((releida) => ({ ficha: releida, despublicada: releida.estado !== 'PUBLICADO' })),
        );
      }),
      switchMap(({ ficha, despublicada }) => this.aVM(ficha).pipe(map((vm): FichaGuardada => ({ ficha: vm, despublicada })))),
      tap(({ ficha }) => this.reemplazar(ficha)),
    );
  }

  /** Relee la ficha y falla con `FichaCambiadaError` si ya no es la que el form leyó (ver `update`). */
  private verificarBase(id: string, base: FichaBase | undefined): Observable<void> {
    if (!base) return of(void 0);
    return this.fichas.getById(id).pipe(
      switchMap((actual) => {
        if (actual.sinContenido) return throwError(() => new FichaSinContenidoError());
        if (!cambioDesdeLaBase(actual, base)) return of(void 0);
        return this.aVM(actual).pipe(switchMap((vm) => throwError(() => new FichaCambiadaError(vm))));
      }),
    );
  }

  /**
   * Ejecuta una acción del workflow: sus transiciones en orden ("Enviar y publicar", P-3, son dos). Si una falla
   * no sigue; si ya se aplicó alguna, relee la ficha (`fichas$` no queda vieja) y propaga el error igual.
   */
  ejecutar(id: string, accion: AccionWorkflow): Observable<FichaLocalVM> {
    let pasos = 0;
    return from(TRANSICIONES_DE_ACCION[accion]).pipe(
      concatMap((transicion) => this.fichas.transicion(id, transicion).pipe(tap(() => pasos++))),
      last(),
      switchMap((ficha) => this.aVM(ficha)),
      tap((actualizada) => this.reemplazar(actualizada)),
      catchError((err: unknown) => {
        if (!pasos) return throwError(() => err);
        return this.getDetalle(id).pipe(
          tap((releida) => this.reemplazar(releida)),
          catchError(() => of(null)),
          switchMap(() => throwError(() => err)),
        );
      }),
    );
  }

  /** "Desactivar" (`DELETE` lógico). El backend la sigue listando: en `fichas$` se actualiza (`trasDesactivar`), no se quita. */
  desactivar(id: string): Observable<void> {
    return this.fichas.desactivar(id).pipe(
      tap(() => {
        const actual = this._fichas$.value.find((f) => f.id === id);
        if (actual) this.reemplazar(trasDesactivar(actual));
      }),
    );
  }

  /** Dirección pública de una ficha publicada, o `null` si la fuente no tiene (mock). */
  urlPublica(slug: string): string | null {
    return this.fichas.urlPublica(slug);
  }

  private reemplazar(ficha: FichaLocalVM): void {
    const lista = this._fichas$.value;
    if (!lista.some((f) => f.id === ficha.id)) return;
    this._fichas$.next(lista.map((f) => (f.id === ficha.id ? ficha : f)));
  }

  /**
   * La adopción de la ficha, con título y slug de su plantilla y nombre del organismo. Sin `READ_ADOPTION`
   * devuelve `null` (desde `V2.28` lo tienen SA, AB, AO y AGENT). `estricto` (alta): un error se propaga.
   */
  private resumenAdopcion(id: string, estricto: boolean): Observable<FichaAdopcionResumen | null> {
    if (!this.auth.can(LEER_ADOPCIONES)) return of(null);
    const resumen$ = this.adopciones.getById(id).pipe(
      switchMap((adopcion) => forkJoin({
        plantilla: this.auth.can(LEER_PLANTILLAS)
          ? this.plantillas.getById(adopcion.plantillaId).pipe(map(nombreDePlantilla), catchError(() => of(null)))
          : of(null),
        contexto: this.contexto(),
      }).pipe(
        map(({ plantilla, contexto }) => resumenDeAdopcion(
          adopcion, plantilla, contexto.organismos.get(adopcion.organismoId) ?? null, new Date(),
        )),
      )),
    );
    return estricto ? resumen$ : resumen$.pipe(catchError(() => of(null)));
  }

  /** `alDia`: relee los catálogos y la adopción de la ficha (lectura de una pantalla; ver `getDetalle`). */
  private aVM(ficha: FichaLocal, alDia = false): Observable<FichaLocalVM> {
    return this.aVMs([ficha], alDia, alDia).pipe(map(([vm]) => vm));
  }

  /**
   * Completa los nombres (`resolverNombres`). `releerSueltas`: olvida lo recordado de las adopciones de ESTAS
   * fichas, para que si no vienen en el listado (deshabilitadas) se vuelvan a pedir; solo para la lectura de una
   * ficha, nunca para un listado (sería un `GET` por adopción en cada recarga).
   */
  private aVMs(lista: FichaLocal[], refrescar = false, releerSueltas = false): Observable<FichaLocalVM[]> {
    if (!lista.length) return of([]);
    return this.contexto(refrescar).pipe(
      tap(() => {
        if (releerSueltas) lista.forEach((ficha) => this.sueltas.adopciones.delete(ficha.adopcionId));
      }),
      switchMap((contexto) => this.completarSueltas(lista, contexto)),
      map((contexto) => {
        const ahora = new Date();
        return lista.map((ficha) => resolverNombres(ficha, contexto, this.sueltas, ahora));
      }),
    );
  }

  /**
   * Lee con `GET /{id}` (que también devuelve las inactivas) las adopciones y plantillas de estas fichas que no
   * vinieron en los listados, y las recuerda en `sueltas`: cada una se pide una sola vez por sesión, con
   * concurrencia acotada (`leerDeAUno`). Primero las adopciones: de ellas sale qué plantillas faltan.
   */
  private completarSueltas(lista: FichaLocal[], ctx: CatalogosDeFichas): Observable<CatalogosDeFichas> {
    const faltanAdopciones = this.auth.can(LEER_ADOPCIONES) ? adopcionesSinLeer(lista, ctx, this.sueltas) : [];
    return this.leerSueltas(faltanAdopciones, (id) => this.adopciones.getById(id), this.sueltas.adopciones).pipe(
      switchMap(() => {
        if (!this.auth.can(LEER_PLANTILLAS)) return of(ctx);
        return this.leerSueltas(
          plantillasSinLeer(lista, ctx, this.sueltas),
          (id) => this.plantillas.getById(id).pipe(map(nombreDePlantilla)),
          this.sueltas.plantillas,
        ).pipe(map(() => ctx));
      }),
    );
  }

  /** `leerDeAUno` que recuerda en `cache`, salvo que mientras tanto se haya invalidado (cambió la sesión). */
  private leerSueltas<T>(ids: string[], leer: (id: string) => Observable<T>, cache: Map<string, T | null>): Observable<void> {
    const generacion = this.generacion;
    return leerDeAUno(ids, leer, {
      recordar: (id, valor) => { if (generacion === this.generacion) cache.set(id, valor); },
      esDefinitivo: esLecturaDefinitiva,
    });
  }

  private contexto(refrescar = false): Observable<CatalogosDeFichas> {
    const clave = [LEER_ADOPCIONES, LEER_PLANTILLAS, LEER_ORGANISMOS].map((p) => this.auth.can(p)).join('|');
    if (clave !== this.contextoClave) {
      this.invalidarContexto();
      this.contextoClave = clave;
      refrescar = true;
    }
    if (!this.contextoCache$ || refrescar) {
      // Refrescar relee los LISTADOS; las lecturas sueltas se conservan (ver `completarSueltas`).
      const cache$: Observable<CatalogosDeFichas> = forkJoin({
        adopciones: this.leer(LEER_ADOPCIONES, () => this.adopciones.list(), (a): AdopcionDeFicha => a),
        plantillas: this.leer(LEER_PLANTILLAS, () => this.plantillas.list(), nombreDePlantilla),
        // `list()` y no `getOptions()`: también hay que nombrar organismos desactivados.
        organismos: this.leer(LEER_ORGANISMOS, () => this.organismos.list(), (o) => o.nombre),
        localidades: this.leer(null, () => this.localidades.getLocalidades(), (l) => l),
      }).pipe(
        map(catalogosDe),
        tap((ctx) => {
          // Solo se invalida a sí misma: una lectura vieja que termina tarde no borra una más nueva.
          if (ctx.degradado && this.contextoCache$ === cache$) this.contextoCache$ = null;
        }),
        shareReplay(1),
      );
      this.contextoCache$ = cache$;
    }
    return this.contextoCache$;
  }

  private invalidarContexto(): void {
    this.contextoCache$ = null;
    this.contextoClave = '';
    this.generacion++;
    this.sueltas.adopciones.clear();
    this.sueltas.plantillas.clear();
  }

  /** Lee un catálogo por id si hay permiso (`null` = público); si falla, queda vacío y lo anota. */
  private leer<T extends { id: string }, V>(
    permiso: string | null, fuente: () => Observable<T[]>, valor: (item: T) => V,
  ): Observable<LecturaDeCatalogo<V>> {
    if (permiso && !this.auth.can(permiso)) return of({ mapa: new Map<string, V>(), fallo: false });
    return fuente().pipe(
      map((lista) => ({ mapa: new Map(lista.map((item): [string, V] => [item.id, valor(item)])), fallo: false })),
      catchError(() => of({ mapa: new Map<string, V>(), fallo: true })),
    );
  }
}
