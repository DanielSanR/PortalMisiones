import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, Observable, catchError, concatMap, throwError, defer, distinctUntilChanged, forkJoin, from, last, map,
  mergeMap, of, shareReplay, skip, switchMap, tap, toArray,
} from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { PUBLICACION_POLICY } from '@core/constants/policy-overrides.constants';
import { canonicalizarSlug } from '@core/utils/slug.utils';
import { Adopcion, AdopcionesRepository } from '@features/adopciones';
import { PlantillasRepository } from '@features/plantillas';
import { OrganismosRepository } from '@features/organismos';
import { LocalidadVM, LocalidadesRepository } from '@features/localidades';
import { FichasLocalesRepository } from '../repositories/fichas-locales.repository';
import {
  FichaAdopcionResumen, FichaBase, FichaFormData, FichaGuardada, FichaLocal, FichaLocalFormValue, FichaLocalVM,
  FichasDeAdopcion, MotivoNoVigente,
} from '../models/ficha-local.vm';
import { DespublicacionFallidaError, FichaCambiadaError, FichaSinContenidoError } from '../models/ficha-errores';
import { AccionWorkflow, TRANSICIONES_DE_ACCION, accionesDisponibles } from '../models/workflow';
import { motivoNoVigente } from '../models/vigencia-adopcion';

/** Permisos que exige leer cada catálogo de nombres en el backend. Las localidades son públicas. */
const LEER_ADOPCIONES = 'READ_ADOPTION';
const LEER_PLANTILLAS = 'READ_PROCEDURE';
const LEER_ORGANISMOS = 'READ_ORGANISM';
/** Permiso de publicar/despublicar (D-3: decide el permiso, nunca el rol). */
const PUBLICAR = 'PUBLISH_VARIANT';

/** Lecturas sueltas (`GET /{id}`) en paralelo, como mucho: un listado con muchas adopciones deshabilitadas no abre N conexiones. */
const CONCURRENCIA_SUELTAS = 4;

/** El `GET /{id}` dijo que no existe o que está fuera del alcance: volver a pedirlo no cambia nada. */
function esLecturaDefinitiva(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === 404 || status === 403;
}

/** Acciones de workflow que se ofrecen para una ficha con la sesión vigente. */
export type ResolverAccionesWorkflow = (ficha: Pick<FichaLocalVM, 'estado' | 'activa'>) => AccionWorkflow[];

interface PlantillaNombre {
  titulo: string;
  slug: string;
}

/** Catálogos para resolver los ids de una ficha. Un mapa vacío = no se pudo (o no se puede) leer. */
interface Contexto {
  adopciones: Map<string, Adopcion>;
  plantillas: Map<string, PlantillaNombre>;
  organismos: Map<string, string>;
  localidades: Map<string, LocalidadVM>;
  /** Algún catálogo falló (no por falta de permiso): no se cachea, para reintentar en el próximo uso. */
  degradado: boolean;
}

/** Resultado de leer un catálogo: el mapa (vacío si no hay permiso o falló) y si falló. */
interface Lectura<T> {
  mapa: Map<string, T>;
  fallo: boolean;
}

/**
 * Facade de fichas por localidad (`/api/organism-procedure-location`, real o mock según
 * `featureOverrides`) y de su workflow de publicación. Expone Observables (async pipe; NO signals).
 * Depende solo de repositorios: el propio y, para los nombres que el backend no devuelve, los de
 * adopciones, plantillas, organismos y localidades (vía su barrel, nunca sus facades).
 *
 * Los nombres degradan a `null` en vez de tumbar la pantalla. Excepción documentada de sesión
 * (`.claude/rules/arquitectura-capas.md`): `AuthTokenService` se consulta SOLO para no pedir un
 * catálogo que el usuario no puede leer — AGENT ya tiene `READ_ADOPTION` (R-3: `V2.28`/`V2.30`) pero no
 * `READ_PROCEDURE` (G-3), y solo SA tiene `READ_ORGANISM`; pedirlos abriría 403. Las localidades son
 * públicas. Se decide siempre por permiso, nunca por rol.
 *
 * También deriva de la sesión, como Observables, lo que el workflow ofrece (`puedePublicar$`,
 * `accionesWorkflow$`): así las pantallas consumen solo este facade y no inyectan `AuthTokenService`.
 * La regla es `accionesDisponibles` (permiso, nunca rol: D-3) + `PUBLICACION_POLICY`; el permiso de
 * cada acción lo vuelve a exigir el backend.
 */
@Injectable({ providedIn: 'root' })
export class FichasLocalesFacade {
  private readonly _fichas$ = new BehaviorSubject<FichaLocalVM[]>([]);
  /** Todas las fichas del alcance, activas e inactivas (el backend lista las dos). */
  readonly fichas$ = this._fichas$.asObservable();

  /** ¿Puede publicar (`PUBLISH_VARIANT`)? Reactivo a la sesión: la bandeja "En revisión" es suya. */
  readonly puedePublicar$: Observable<boolean>;

  /**
   * Resolver de las acciones de workflow de una ficha según estado, `activa` y permisos. Se re-emite en
   * cada cambio de sesión (otro usuario, refresh de token con otros permisos), para que la UI se redibuje.
   */
  readonly accionesWorkflow$: Observable<ResolverAccionesWorkflow>;

  /**
   * ¿Los datos son simulados (no se guardan en el servidor)? Lo decide la fuente; la UI muestra un aviso
   * persistente solo en ese caso (hoy, el modo todo-mock de `ng serve`).
   */
  get fuenteSimulada(): boolean {
    return this.fichas.fuenteSimulada;
  }

  private contextoCache$: Observable<Contexto> | null = null;
  /** Permisos con los que se armó la caché: si la sesión cambia (otro rol, refresh), se rearma. */
  private contextoClave = '';
  /**
   * Adopciones deshabilitadas (no vienen en el listado), leídas de a una con `GET /{id}` y recordadas por id
   * hasta que cambie la sesión o sus permisos: recargar el listado no las vuelve a pedir. `null` = el backend
   * dijo que no existe o está fuera del alcance (tampoco se reintenta). La lectura de UNA ficha (`getDetalle`)
   * sí vuelve a pedir la suya, para que el aviso de vigencia no salga de un dato viejo.
   */
  private readonly adopcionesSueltas = new Map<string, Adopcion | null>();
  /** Plantillas desactivadas (no vienen en el listado): misma regla que `adopcionesSueltas`. */
  private readonly plantillasSueltas = new Map<string, PlantillaNombre | null>();
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
    this.puedePublicar$ = this.auth.getCurrentUser$().pipe(
      map(() => this.auth.can(PUBLICAR)),
      distinctUntilChanged(),
    );
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
   * Carga el listado con los nombres resueltos y lo publica en `fichas$`. Vacía el stream al empezar
   * (singleton: si no, mientras carga o si falla se verían filas viejas) y refresca los nombres.
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
   * Una ficha (activa o no) con los nombres resueltos. Es la lectura de una PANTALLA (detalle, form de edición):
   * la vigencia de su adopción (`adopcionNoVigente`) se calcula con datos recién leídos, no con la caché de la
   * sesión; si no, habilitar/deshabilitar la adopción o cambiarle la vigencia en "Trámites del organismo" no se
   * vería acá hasta cerrar sesión. Cuesta releer los catálogos y, a lo sumo, un `GET` de su adopción.
   */
  getDetalle(id: string): Observable<FichaLocalVM> {
    return this.fichas.getById(id).pipe(switchMap((ficha) => this.aVM(ficha, true)));
  }

  /**
   * Fichas (activas e inactivas) de una adopción, para el detalle del trámite del organismo: las filtra
   * la fuente (`?organismProcedureId=`). Además dice si hoy se le pueden agregar fichas (el backend solo
   * lo acepta con la adopción vigente); si la adopción no se puede leer, eso queda sin decidir (`null`)
   * y la lista se muestra igual. No toca `fichas$`.
   *
   * Se vuelve a filtrar acá por `adopcionId` para no depender del filtro del servidor (igual que
   * `PuntosAtencionFacade.getDeFicha`): un backend anterior a `586b670` ignora `?organismProcedureId=` y
   * devuelve TODO el alcance, que se mostraría como fichas de esta adopción. COMPATIBILIDAD TEMPORAL: ese
   * backend además no dice de qué adopción es cada ficha; en ese caso no se muestra ninguna y `sinContenido`
   * lo avisa (un vacío sin aviso se leería como "no tiene fichas").
   */
  getDeAdopcion(adopcionId: string): Observable<FichasDeAdopcion> {
    const motivo$: Observable<MotivoNoVigente | null> = this.auth.can(LEER_ADOPCIONES)
      ? this.adopciones.getById(adopcionId).pipe(
        map((adopcion) => motivoNoVigente(adopcion, new Date())),
        catchError(() => of(null)),
      )
      : of(null);
    return forkJoin({
      leidas: this.fichas.list({ adopcionId }).pipe(
        switchMap((lista) => this.aVMs(lista.filter((f) => f.adopcionId === adopcionId)).pipe(
          map((fichas) => ({ fichas, sinContenido: lista.some((f) => f.sinContenido) })),
        )),
      ),
      motivoNoVigente: motivo$,
    }).pipe(map(({ leidas, motivoNoVigente: motivo }) => ({ ...leidas, motivoNoVigente: motivo })));
  }

  /**
   * Todo lo que necesita el form: la ficha (en edición), su adopción (título y `slugBase` para el
   * slug sugerido, P-5), las localidades y lo ya ocupado para validar duplicados antes de guardar.
   * En alta, que la adopción no exista es un error (no hay a qué colgar la ficha); en edición, no
   * poder leerla solo deja los nombres sin resolver.
   *
   * Se pide el listado completo del alcance (sin `?organismProcedureId=`) porque los slugs se validan
   * contra TODAS las fichas visibles, no solo las de la adopción; con ese mismo listado se sacan las
   * localidades ocupadas de la adopción, sin un segundo pedido.
   *
   * La vigencia de la adopción sale siempre de una lectura nueva: la de la ficha por `getDetalle` (que relee
   * los catálogos) y la del resumen por `GET /{id}` de la adopción.
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
          map(({ adopcion, localidades, todas }): FichaFormData => {
            // También las desactivadas: los UNIQUE del backend (`V2.27`) no distinguen `active`.
            const otras = todas.filter((f) => f.id !== ficha?.id);
            const deLaAdopcion = idAdopcion ? otras.filter((f) => f.adopcionId === idAdopcion) : [];
            const conFichaActiva = new Set(deLaAdopcion.filter((f) => f.activa).map((f) => f.localidadId));
            return {
              ficha,
              adopcion,
              localidades: localidades
                .map((l) => ({ id: l.id, nombre: l.nombre, departamentoNombre: l.departamentoNombre }))
                .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR', { sensitivity: 'base' })),
              ocupadas: {
                localidadIds: [...new Set(deLaAdopcion.map((f) => f.localidadId))],
                localidadIdsDesactivadas: [...new Set(deLaAdopcion
                  .map((f) => f.localidadId)
                  .filter((id) => !conFichaActiva.has(id)))],
                slugs: otras.map((f) => canonicalizarSlug(f.slug)),
              },
            };
          }),
        );
      }),
    );
  }

  /**
   * Trámites del organismo (adopciones) habilitados, con el nombre del trámite y del organismo y si están
   * VIGENTES: es lo que el alta sin `?adopcion=` deja elegir. El backend solo acepta fichas de una adopción
   * vigente (si no, 404), así que las habilitadas que todavía no empezaron o ya vencieron vienen marcadas
   * (`vigente = false` + motivo) para que el form las muestre como no elegibles en vez de esconderlas. Las
   * deshabilitadas no vienen: el listado del backend no las devuelve. Sin `READ_ADOPTION` devuelve `[]` (el
   * alta tampoco se ofrece sin ese permiso: `CREAR_FICHA_ACCESS`). Relee los catálogos (no usa la caché): lo
   * que se acaba de adoptar tiene que aparecer. Ordenadas por trámite y organismo; las que no tienen nombre
   * (sin `READ_PROCEDURE`) quedan al final.
   */
  getAdopcionesParaFicha(): Observable<FichaAdopcionResumen[]> {
    if (!this.auth.can(LEER_ADOPCIONES)) return of([]);
    return this.contexto(true).pipe(
      map((contexto) => [...contexto.adopciones.values()]
        .filter((a) => a.habilitada)
        .map((a) => this.aResumen(a, contexto.plantillas.get(a.plantillaId) ?? null, contexto.organismos.get(a.organismoId) ?? null))
        .sort((a, b) => {
          if (!a.plantillaTitulo !== !b.plantillaTitulo) return a.plantillaTitulo ? -1 : 1;
          return (a.plantillaTitulo ?? '').localeCompare(b.plantillaTitulo ?? '', 'es-AR', { sensitivity: 'base' })
            || (a.organismoNombre ?? '').localeCompare(b.organismoNombre ?? '', 'es-AR', { sensitivity: 'base' });
        })),
    );
  }

  /** Alta: queda en `BORRADOR`, versión 1. */
  create(form: FichaLocalFormValue): Observable<FichaLocalVM> {
    return this.fichas.create(form).pipe(
      switchMap((ficha) => this.aVM(ficha)),
      tap((creada) => this._fichas$.next([...this._fichas$.value, creada])),
    );
  }

  /**
   * Edición (PUT total sobre lo que devolvió el `GET`). Guardar no cambia el estado de publicación: el
   * backend lo conserva. Hay una excepción, y el resultado la informa (`despublicada`):
   *
   * Desactivar una ficha PUBLICADA es cosa de "Desactivar" (`DELETE`, que además la despublica): un PUT
   * con `active=false` la deja inactiva pero `PUBLICADO`. El form no lo ofrece (bloquea el interruptor de
   * una publicada activa), pero pasa igual si la publicaron mientras se editaba, o al guardar cualquier cambio
   * en una ficha que YA estaba publicada e inactiva. Ahí se completa con el `DELETE` y se relee, para que no
   * quede en ese estado contradictorio. Si ese segundo paso falla, el error es `DespublicacionFallidaError`
   * (los cambios SÍ se guardaron), no un error de guardado.
   *
   * `base` (lo que el form leyó): el PUT no viaja con versión, así que el backend solo rechaza dos escrituras
   * simultáneas (`4091`); un formulario abierto hace rato pisaría sin aviso lo que otro guardó. Para
   * achicar ese riesgo se relee la ficha justo antes del PUT y, si cambió de versión, de estado o de `activa`
   * (el `DELETE` que desactiva no suma versión), no se guarda:
   * `FichaCambiadaError` con la ficha actual, y la pantalla decide (recargar, o volver a llamar con la base
   * nueva para guardar a sabiendas). Es una mitigación, no un candado: entre esa lectura y el PUT queda una
   * ventana de milisegundos. Sin `base` no se compara.
   *
   * COMPATIBILIDAD TEMPORAL: sin adopción o localidad (ficha `sinContenido`, backend anterior a `586b670`)
   * no se envía nada: `FichaSinContenidoError`.
   */
  update(id: string, form: FichaLocalFormValue, base?: FichaBase): Observable<FichaGuardada> {
    if (!form.adopcionId || !form.localidadId) return throwError(() => new FichaSinContenidoError());
    return this.verificarBase(id, base).pipe(
      switchMap(() => this.fichas.update(id, form)),
      switchMap((guardada): Observable<{ ficha: FichaLocal; despublicada: boolean }> => {
        if (guardada.estado !== 'PUBLICADO' || guardada.activa) return of({ ficha: guardada, despublicada: false });
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
        // `activa` aparte de la versión: desactivar (`DELETE`) una ficha que no está publicada no cambia ni la
        // versión ni el estado, y el PUT (que lleva `active`) la reactivaría sin que nadie lo pidiera.
        if (actual.version === base.version && actual.estado === base.estado && actual.activa === base.activa) return of(void 0);
        return this.aVM(actual).pipe(switchMap((vm) => throwError(() => new FichaCambiadaError(vm))));
      }),
    );
  }

  /**
   * Ejecuta una acción del workflow: uno o más endpoints de transición en orden (el atajo
   * "Enviar y publicar" de P-3 son dos). Si uno falla, los siguientes no se ejecutan; si ya se había
   * aplicado alguno, la ficha se relee para que `fichas$` no quede con un estado viejo, y el error se
   * propaga igual.
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

  /**
   * "Desactivar" (`DELETE` lógico): `active=false` y, si estaba publicada, `DESPUBLICADO`. El backend
   * la sigue listando, así que en `fichas$` se actualiza con la misma regla en vez de quitarla.
   */
  desactivar(id: string): Observable<void> {
    return this.fichas.desactivar(id).pipe(
      tap(() => {
        const actual = this._fichas$.value.find((f) => f.id === id);
        if (!actual) return;
        this.reemplazar({
          ...actual,
          activa: false,
          estado: actual.estado === 'PUBLICADO' ? 'DESPUBLICADO' : actual.estado,
        });
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
   * La adopción de la ficha, con título y slug de su plantilla y nombre del organismo. Sin
   * `READ_ADOPTION` devuelve `null` (desde `V2.28` lo tienen SA, AB, AO y AGENT). `estricto` (alta): un
   * error se propaga.
   */
  private resumenAdopcion(id: string, estricto: boolean): Observable<FichaAdopcionResumen | null> {
    if (!this.auth.can(LEER_ADOPCIONES)) return of(null);
    const resumen$ = this.adopciones.getById(id).pipe(
      switchMap((adopcion) => forkJoin({
        plantilla: this.auth.can(LEER_PLANTILLAS)
          ? this.plantillas.getById(adopcion.plantillaId).pipe(
            map((p): PlantillaNombre | null => ({ titulo: p.titulo, slug: p.slug })),
            catchError(() => of(null)),
          )
          : of(null),
        contexto: this.contexto(),
      }).pipe(
        map(({ plantilla, contexto }) => this.aResumen(adopcion, plantilla, contexto.organismos.get(adopcion.organismoId) ?? null)),
      )),
    );
    return estricto ? resumen$ : resumen$.pipe(catchError(() => of(null)));
  }

  /** Resumen de una adopción, con su vigencia calculada ahora (misma regla que el backend al guardar la ficha). */
  private aResumen(adopcion: Adopcion, plantilla: PlantillaNombre | null, organismoNombre: string | null): FichaAdopcionResumen {
    const motivo = motivoNoVigente(adopcion, new Date());
    return {
      id: adopcion.id,
      plantillaTitulo: plantilla?.titulo ?? null,
      plantillaSlug: plantilla?.slug ?? null,
      organismoNombre,
      habilitada: adopcion.habilitada,
      vigente: motivo === null,
      motivoNoVigente: motivo,
      vigenteDesde: adopcion.vigenteDesde,
      vigenteHasta: adopcion.vigenteHasta,
    };
  }

  /** `alDia`: relee los catálogos y la adopción de la ficha (lectura de una pantalla; ver `getDetalle`). */
  private aVM(ficha: FichaLocal, alDia = false): Observable<FichaLocalVM> {
    return this.aVMs([ficha], alDia, alDia).pipe(map(([vm]) => vm));
  }

  /**
   * Completa los nombres. Las adopciones y plantillas que no vienen en sus listados se piden de a una (una vez
   * por sesión). `releerSueltas`: olvida lo recordado de las adopciones de ESTAS fichas, para que si no vienen en
   * el listado (deshabilitadas) se vuelvan a pedir; solo para la lectura de una ficha, nunca para un listado
   * (sería un `GET` por adopción en cada recarga).
   */
  private aVMs(lista: FichaLocal[], refrescar = false, releerSueltas = false): Observable<FichaLocalVM[]> {
    if (!lista.length) return of([]);
    return this.contexto(refrescar).pipe(
      tap(() => {
        if (releerSueltas) lista.forEach((ficha) => this.adopcionesSueltas.delete(ficha.adopcionId));
      }),
      switchMap((contexto) => this.completarSueltas(lista, contexto)),
      map((contexto) => lista.map((ficha) => this.resolver(ficha, contexto))),
    );
  }

  private resolver(ficha: FichaLocal, ctx: Contexto): FichaLocalVM {
    const adopcion = this.adopcionDe(ficha, ctx);
    const plantillaId = adopcion?.plantillaId ?? null;
    const organismoId = adopcion?.organismoId ?? null;
    const plantilla = plantillaId ? ctx.plantillas.get(plantillaId) ?? this.plantillasSueltas.get(plantillaId) : undefined;
    return {
      ...ficha,
      plantillaId,
      organismoId,
      plantillaTitulo: plantilla?.titulo ?? null,
      organismoNombre: (organismoId ? ctx.organismos.get(organismoId) : undefined) ?? null,
      localidadNombre: ctx.localidades.get(ficha.localidadId)?.nombre ?? null,
      // Sin la adopción (sin permiso o no se pudo leer) queda sin decidir: `null`.
      adopcionNoVigente: adopcion ? motivoNoVigente(adopcion, new Date()) : null,
    };
  }

  /** La adopción de una ficha: la del listado o, si está deshabilitada, la leída suelta. */
  private adopcionDe(ficha: FichaLocal, ctx: Contexto): Adopcion | null {
    return ctx.adopciones.get(ficha.adopcionId) ?? this.adopcionesSueltas.get(ficha.adopcionId) ?? null;
  }

  /**
   * El listado de adopciones solo trae las habilitadas, y el de plantillas solo las activas: una ficha
   * de una adopción deshabilitada (o de una plantilla desactivada) quedaría sin nombres. Esas se leen
   * con `GET /{id}` (que también devuelve las inactivas) y se recuerdan por id (`adopcionesSueltas`,
   * `plantillasSueltas`): cada una se pide una sola vez por sesión, no en cada recarga del listado, y de a
   * `CONCURRENCIA_SUELTAS` por vez. Si una deshabilitada vuelve a habilitarse aparece en el listado, que gana.
   */
  private completarSueltas(lista: FichaLocal[], ctx: Contexto): Observable<Contexto> {
    const faltanAdopciones = this.auth.can(LEER_ADOPCIONES)
      // `filter(Boolean)`: una ficha `sinContenido` no trae adopción; no hay nada que pedir.
      ? [...new Set(lista.map((f) => f.adopcionId).filter(Boolean))]
        .filter((id) => !ctx.adopciones.has(id) && !this.adopcionesSueltas.has(id))
      : [];

    return this.leerSueltas(faltanAdopciones, (id) => this.adopciones.getById(id), this.adopcionesSueltas).pipe(
      switchMap(() => {
        if (!this.auth.can(LEER_PLANTILLAS)) return of(ctx);
        const faltanPlantillas = [...new Set(lista
          .map((f) => this.adopcionDe(f, ctx)?.plantillaId)
          .filter((id): id is string => !!id))]
          .filter((id) => !ctx.plantillas.has(id) && !this.plantillasSueltas.has(id));
        return this.leerSueltas(
          faltanPlantillas,
          (id) => this.plantillas.getById(id).pipe(map((p): PlantillaNombre => ({ titulo: p.titulo, slug: p.slug }))),
          this.plantillasSueltas,
        ).pipe(map(() => ctx));
      }),
    );
  }

  /**
   * Lee `ids` de a uno, con concurrencia acotada, y los recuerda en `cache`. Un fallo no tumba el resto: el
   * nombre queda sin resolver. Un 404/403 se recuerda como `null` (no se reintenta); cualquier otro fallo
   * (conexión, 5xx) no se recuerda, para volver a probar en la próxima lectura.
   */
  private leerSueltas<T>(ids: string[], leer: (id: string) => Observable<T>, cache: Map<string, T | null>): Observable<void> {
    if (!ids.length) return of(void 0);
    const generacion = this.generacion;
    const recordar = (id: string, valor: T | null): void => {
      if (generacion === this.generacion) cache.set(id, valor);
    };
    return from(ids).pipe(
      mergeMap((id) => leer(id).pipe(
        tap((valor) => recordar(id, valor)),
        catchError((err: unknown) => {
          if (esLecturaDefinitiva(err)) recordar(id, null);
          return of(null);
        }),
      ), CONCURRENCIA_SUELTAS),
      toArray(),
      map(() => void 0),
    );
  }

  private contexto(refrescar = false): Observable<Contexto> {
    const clave = [LEER_ADOPCIONES, LEER_PLANTILLAS, LEER_ORGANISMOS].map((p) => this.auth.can(p)).join('|');
    if (clave !== this.contextoClave) {
      this.invalidarContexto();
      this.contextoClave = clave;
      refrescar = true;
    }
    if (!this.contextoCache$ || refrescar) {
      // Refrescar relee los LISTADOS; las lecturas sueltas se conservan (ver `completarSueltas`).
      const cache$: Observable<Contexto> = forkJoin({
        adopciones: this.leer(LEER_ADOPCIONES, () => this.adopciones.list().pipe(
          map((lista) => lista.map((a): [string, Adopcion] => [a.id, a])),
        )),
        plantillas: this.leer(LEER_PLANTILLAS, () => this.plantillas.list().pipe(
          map((lista) => lista.map((p): [string, PlantillaNombre] => [p.id, { titulo: p.titulo, slug: p.slug }])),
        )),
        // `list()` y no `getOptions()`: también hay que nombrar organismos desactivados.
        organismos: this.leer(LEER_ORGANISMOS, () => this.organismos.list().pipe(
          map((lista) => lista.map((o): [string, string] => [o.id, o.nombre])),
        )),
        localidades: this.leer(null, () => this.localidades.getLocalidades().pipe(
          map((lista) => lista.map((l): [string, LocalidadVM] => [l.id, l])),
        )),
      }).pipe(
        map((r): Contexto => ({
          adopciones: r.adopciones.mapa,
          plantillas: r.plantillas.mapa,
          organismos: r.organismos.mapa,
          localidades: r.localidades.mapa,
          degradado: r.adopciones.fallo || r.plantillas.fallo || r.organismos.fallo || r.localidades.fallo,
        })),
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
    this.adopcionesSueltas.clear();
    this.plantillasSueltas.clear();
  }

  /** Lee un catálogo si hay permiso (`null` = público); si falla, queda vacío y lo anota. */
  private leer<T>(permiso: string | null, fuente: () => Observable<[string, T][]>): Observable<Lectura<T>> {
    if (permiso && !this.auth.can(permiso)) return of({ mapa: new Map<string, T>(), fallo: false });
    return fuente().pipe(
      map((pares) => ({ mapa: new Map(pares), fallo: false })),
      catchError(() => of({ mapa: new Map<string, T>(), fallo: true })),
    );
  }
}

