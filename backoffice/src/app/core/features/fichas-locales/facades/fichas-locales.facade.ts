import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, Observable, catchError, concatMap, throwError, defer, distinctUntilChanged, forkJoin, from, last, map, of,
  shareReplay, skip, switchMap, tap,
} from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { canonicalizarSlug } from '@core/utils/slug.utils';
import { Adopcion, AdopcionesRepository } from '@features/adopciones';
import { PlantillasRepository } from '@features/plantillas';
import { OrganismosRepository } from '@features/organismos';
import { LocalidadVM, LocalidadesRepository } from '@features/localidades';
import { FichasLocalesRepository } from '../repositories/fichas-locales.repository';
import {
  FichaAdopcionResumen, FichaFormData, FichaLocal, FichaLocalFormValue, FichaLocalVM,
} from '../models/ficha-local.vm';
import { AccionWorkflow, TRANSICIONES_DE_ACCION } from '../models/workflow';

/** Permisos que exige leer cada catálogo de nombres en el backend. Las localidades son públicas. */
const LEER_ADOPCIONES = 'READ_ADOPTION';
const LEER_PLANTILLAS = 'READ_PROCEDURE';
const LEER_ORGANISMOS = 'READ_ORGANISM';

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
 * catálogo que el usuario no puede leer — AGENT no tiene `READ_ADOPTION` ni `READ_PROCEDURE` (G-3) y
 * solo SA tiene `READ_ORGANISM`; pedirlos abriría 403. Las localidades son públicas.
 *
 * Con el response real de hoy (G-1) la ficha no trae adopción ni localidad: todos los nombres quedan
 * en `null` y el form no deja editar (`contenidoCompleto = false`).
 */
@Injectable({ providedIn: 'root' })
export class FichasLocalesFacade {
  private readonly _fichas$ = new BehaviorSubject<FichaLocalVM[]>([]);
  /** Todas las fichas del alcance, activas e inactivas (el backend lista las dos). */
  readonly fichas$ = this._fichas$.asObservable();

  private contextoCache$: Observable<Contexto> | null = null;
  /** Permisos con los que se armó la caché: si la sesión cambia (otro rol, refresh), se rearma. */
  private contextoClave = '';
  /** Adopciones deshabilitadas (no vienen en el listado), leídas de a una con `GET /{id}`. */
  private readonly adopcionesSueltas = new Map<string, Adopcion>();
  /** Plantillas desactivadas (no vienen en el listado), leídas de a una con `GET /{id}`. */
  private readonly plantillasSueltas = new Map<string, PlantillaNombre>();

  constructor(
    private fichas: FichasLocalesRepository,
    private adopciones: AdopcionesRepository,
    private plantillas: PlantillasRepository,
    private organismos: OrganismosRepository,
    private localidades: LocalidadesRepository,
    private auth: AuthTokenService,
  ) {
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

  /** Una ficha (activa o no) con los nombres resueltos. */
  getDetalle(id: string): Observable<FichaLocalVM> {
    return this.fichas.getById(id).pipe(switchMap((ficha) => this.aVM(ficha)));
  }

  /**
   * Fichas (activas e inactivas) de una adopción, para el detalle del trámite del organismo. El
   * backend no filtra por adopción (G-1): se pide el listado completo del alcance y se filtra acá.
   * No toca `fichas$`.
   */
  getDeAdopcion(adopcionId: string): Observable<FichaLocalVM[]> {
    return this.fichas.list().pipe(
      map((lista) => lista.filter((f) => f.adopcionId === adopcionId)),
      switchMap((lista) => this.aVMs(lista)),
    );
  }

  /**
   * Todo lo que necesita el form: la ficha (en edición), su adopción (título y `slugBase` para el
   * slug sugerido, P-5), las localidades y lo ya ocupado para validar duplicados (G-9).
   * En alta, que la adopción no exista es un error (no hay a qué colgar la ficha); en edición, no
   * poder leerla solo deja los nombres sin resolver.
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
            const otrasActivas = todas.filter((f) => f.activa && f.id !== ficha?.id);
            return {
              ficha,
              adopcion,
              localidades: localidades
                .map((l) => ({ id: l.id, nombre: l.nombre, departamentoNombre: l.departamentoNombre }))
                .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR', { sensitivity: 'base' })),
              ocupadas: {
                localidadIds: idAdopcion
                  ? otrasActivas.filter((f) => f.adopcionId === idAdopcion && f.localidadId).map((f) => f.localidadId as string)
                  : [],
                slugs: otrasActivas.map((f) => canonicalizarSlug(f.slug)),
              },
            };
          }),
        );
      }),
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
   * Edición (PUT total). Antes de guardar se relee la ficha para mandar su estado ACTUAL en
   * `publicationStatus` (mitiga R-1, y evita que una edición con datos viejos revierta una
   * publicación o despublicación hecha mientras tanto). El estado nunca lo elige el usuario.
   */
  update(id: string, form: FichaLocalFormValue): Observable<FichaLocalVM> {
    return this.fichas.getById(id).pipe(
      switchMap((actual) => this.fichas.update(id, form, actual.estado)),
      switchMap((ficha) => this.aVM(ficha)),
      tap((actualizada) => this.reemplazar(actualizada)),
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
   * `READ_ADOPTION` (AGENT) devuelve `null`. `estricto` (alta): un error se propaga.
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
        map(({ plantilla, contexto }): FichaAdopcionResumen => ({
          id: adopcion.id,
          plantillaTitulo: plantilla?.titulo ?? null,
          plantillaSlug: plantilla?.slug ?? null,
          organismoNombre: contexto.organismos.get(adopcion.organismoId) ?? null,
          habilitada: adopcion.habilitada,
        })),
      )),
    );
    return estricto ? resumen$ : resumen$.pipe(catchError(() => of(null)));
  }

  private aVM(ficha: FichaLocal): Observable<FichaLocalVM> {
    return this.aVMs([ficha]).pipe(map(([vm]) => vm));
  }

  /** Completa los nombres. Las adopciones y plantillas que no vienen en sus listados se piden de a una. */
  private aVMs(lista: FichaLocal[], refrescar = false): Observable<FichaLocalVM[]> {
    if (!lista.length) return of([]);
    return this.contexto(refrescar).pipe(
      switchMap((contexto) => this.completarSueltas(lista, contexto)),
      map((contexto) => lista.map((ficha) => this.resolver(ficha, contexto))),
    );
  }

  private resolver(ficha: FichaLocal, ctx: Contexto): FichaLocalVM {
    const adopcion = ficha.adopcionId
      ? ctx.adopciones.get(ficha.adopcionId) ?? this.adopcionesSueltas.get(ficha.adopcionId)
      : undefined;
    const plantillaId = ficha.plantillaId ?? adopcion?.plantillaId ?? null;
    const organismoId = ficha.organismoId ?? adopcion?.organismoId ?? null;
    const plantilla = plantillaId ? ctx.plantillas.get(plantillaId) ?? this.plantillasSueltas.get(plantillaId) : undefined;
    return {
      ...ficha,
      plantillaId,
      organismoId,
      plantillaTitulo: ficha.plantillaTitulo ?? plantilla?.titulo ?? null,
      organismoNombre: ficha.organismoNombre ?? (organismoId ? ctx.organismos.get(organismoId) : undefined) ?? null,
      localidadNombre: ficha.localidadNombre ?? (ficha.localidadId ? ctx.localidades.get(ficha.localidadId)?.nombre : undefined) ?? null,
    };
  }

  /**
   * El listado de adopciones solo trae las habilitadas, y el de plantillas solo las activas: una ficha
   * de una adopción deshabilitada (o de una plantilla desactivada) quedaría sin nombres. Esas se leen
   * con `GET /{id}` (que también devuelve las inactivas) y se recuerdan.
   */
  private completarSueltas(lista: FichaLocal[], ctx: Contexto): Observable<Contexto> {
    const faltanAdopciones = this.auth.can(LEER_ADOPCIONES)
      ? [...new Set(lista.map((f) => f.adopcionId).filter((id): id is string => !!id))]
        .filter((id) => !ctx.adopciones.has(id) && !this.adopcionesSueltas.has(id))
      : [];
    const adopciones$ = faltanAdopciones.length
      ? forkJoin(faltanAdopciones.map((id) => this.adopciones.getById(id).pipe(
        tap((a) => this.adopcionesSueltas.set(a.id, a)),
        catchError(() => of(null)),
      )))
      : of([]);

    return adopciones$.pipe(
      switchMap(() => {
        if (!this.auth.can(LEER_PLANTILLAS)) return of(ctx);
        const faltanPlantillas = [...new Set(lista
          .map((f) => f.plantillaId ?? (f.adopcionId
            ? (ctx.adopciones.get(f.adopcionId) ?? this.adopcionesSueltas.get(f.adopcionId))?.plantillaId
            : undefined))
          .filter((id): id is string => !!id))]
          .filter((id) => !ctx.plantillas.has(id) && !this.plantillasSueltas.has(id));
        if (!faltanPlantillas.length) return of(ctx);
        return forkJoin(faltanPlantillas.map((id) => this.plantillas.getById(id).pipe(
          tap((p) => this.plantillasSueltas.set(p.id, { titulo: p.titulo, slug: p.slug })),
          catchError(() => of(null)),
        ))).pipe(map(() => ctx));
      }),
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
      if (refrescar) {
        this.adopcionesSueltas.clear();
        this.plantillasSueltas.clear();
      }
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

