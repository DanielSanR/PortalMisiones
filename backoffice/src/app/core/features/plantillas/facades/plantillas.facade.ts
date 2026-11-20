import { Injectable } from '@angular/core';
import { AuthTokenService } from '@core/services/auth-token.service';
import { BehaviorSubject, Observable, catchError, defer, forkJoin, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { ModalidadesRepository } from '@features/modalidades';
import { CategoriasRepository, CategoriaVM } from '@features/categorias';
import { EtiquetasRepository } from '@features/etiquetas';
import { DestinatariosRepository } from '@features/destinatarios';
import { EventosDeVidaRepository } from '@features/eventos-de-vida';
import { PlantillasRepository } from '../repositories/plantillas.repository';
import {
  PlantillaCatalogos, PlantillaFormData, PlantillaFormValue, PlantillaOpcion, PlantillaRef, PlantillaVM,
} from '../models/plantilla.vm';

/** Resultado de leer un catálogo: si falló, queda vacío y se anota su nombre. */
interface CatalogoLeido {
  nombre: string;
  ok: boolean;
  /** Falló por red/servidor (vale reintentar), no por falta de permiso (reintentar no cambia nada). */
  reintentable: boolean;
  items: PlantillaOpcion[];
}

/**
 * Permiso que exige leer cada catálogo que no es público en el backend. Modalidades, categorías,
 * destinatarios y eventos de vida (`GET /api/modality|category|recipient|life-event`) son públicos y
 * no piden permiso; las etiquetas (`GET /api/tag`) exigen `READ_TAG`.
 */
const LEER_ETIQUETAS = 'READ_TAG';

/** Separador de la ruta jerárquica de una categoría ("Salud › Carnet sanitario"). */
const SEPARADOR_CATEGORIA = ' › ';

/**
 * Facade de plantillas provinciales (`/api/procedure-template` real o mock según `featureOverrides`).
 * Expone Observables (async pipe; NO signals). Depende solo de repositorios: el propio y, para
 * resolver los nombres que el backend no devuelve, los de modalidades, categorías, etiquetas,
 * destinatarios y eventos de vida (vía su barrel; nunca sus facades).
 *
 * Los catálogos se cachean con `shareReplay(1)`. El listado los refresca siempre (es el punto de
 * entrada natural de la sección); el detalle y el form reutilizan la caché. Una lectura degradada
 * (algún catálogo falló) no se cachea, para que el próximo uso lo reintente.
 *
 * Sin el permiso de un catálogo (hoy `READ_TAG` para las etiquetas) ni siquiera se lo pide: el 403 abriría
 * el diálogo global de error. Queda "no disponible" y el resto de la pantalla sigue funcionando. La sesión
 * se consulta en `AuthTokenService` en cada llamada (excepción documentada en `arquitectura-capas.md`).
 */
@Injectable({ providedIn: 'root' })
export class PlantillasFacade {
  private readonly _plantillas$ = new BehaviorSubject<PlantillaVM[]>([]);
  /** Solo las activas: el backend no lista las desactivadas. */
  readonly plantillas$ = this._plantillas$.asObservable();

  private catalogosCache$: Observable<PlantillaCatalogos> | null = null;
  /** Permisos con los que se armó la caché: si la sesión cambia (otro rol), se rearma. */
  private catalogosClave = '';

  constructor(
    private plantillas: PlantillasRepository,
    private modalidades: ModalidadesRepository,
    private categorias: CategoriasRepository,
    private etiquetas: EtiquetasRepository,
    private destinatarios: DestinatariosRepository,
    private eventosDeVida: EventosDeVidaRepository,
    private auth: AuthTokenService,
  ) {}

  /**
   * Carga el listado con los nombres resueltos y lo publica en `plantillas$`. Vacía el stream al
   * empezar: el facade es singleton y, si no, mientras carga (o si falla) se verían filas viejas.
   */
  loadPlantillas(): Observable<PlantillaVM[]> {
    return defer(() => {
      this._plantillas$.next([]);
      return forkJoin({ lista: this.plantillas.list(), catalogos: this.catalogos(true) });
    }).pipe(
      map(({ lista, catalogos }) => lista.map(resolvedorDeNombres(catalogos))),
      tap((lista) => this._plantillas$.next(lista)),
    );
  }

  /** Una plantilla (activa o no) con los nombres resueltos. */
  getDetalle(id: string): Observable<PlantillaVM> {
    return forkJoin({ plantilla: this.plantillas.getById(id), catalogos: this.catalogos() }).pipe(
      map(({ plantilla, catalogos }) => resolvedorDeNombres(catalogos)(plantilla)),
    );
  }

  /** Plantilla en edición (o null en alta) + catálogos de los selects, en una sola llamada. */
  getFormData(id: string | null): Observable<PlantillaFormData> {
    return forkJoin({
      plantilla: id ? this.plantillas.getById(id) : of(null),
      catalogos: this.catalogos(),
    }).pipe(
      map(({ plantilla, catalogos }) => ({
        plantilla: plantilla ? resolvedorDeNombres(catalogos)(plantilla) : null,
        catalogos,
      })),
    );
  }

  create(form: PlantillaFormValue): Observable<PlantillaVM> {
    return this.plantillas.create(form).pipe(
      switchMap((plantilla) => this.conNombres(plantilla)),
      tap((creada) => {
        if (creada.activa) this._plantillas$.next([...this._plantillas$.value, creada]);
      }),
    );
  }

  update(id: string, form: PlantillaFormValue): Observable<PlantillaVM> {
    return this.plantillas.update(id, form).pipe(
      switchMap((plantilla) => this.conNombres(plantilla)),
      tap((actualizada) => {
        const resto = this._plantillas$.value.filter((p) => p.id !== id);
        // Desactivarla desde el form la saca del listado (el backend ya no la devuelve);
        // reactivarla la vuelve a poner.
        if (!actualizada.activa) {
          this._plantillas$.next(resto);
          return;
        }
        const existia = resto.length !== this._plantillas$.value.length;
        this._plantillas$.next(existia
          ? this._plantillas$.value.map((p) => (p.id === id ? actualizada : p))
          : [...resto, actualizada]);
      }),
    );
  }

  /** Borrado lógico (`active=false`): deja de listarse. */
  desactivar(id: string): Observable<void> {
    return this.plantillas.desactivar(id).pipe(
      tap(() => this._plantillas$.next(this._plantillas$.value.filter((p) => p.id !== id))),
    );
  }

  private conNombres(plantilla: PlantillaVM): Observable<PlantillaVM> {
    return this.catalogos().pipe(map((catalogos) => resolvedorDeNombres(catalogos)(plantilla)));
  }

  private catalogos(refrescar = false): Observable<PlantillaCatalogos> {
    const clave = String(this.auth.can(LEER_ETIQUETAS));
    if (clave !== this.catalogosClave) {
      this.catalogosClave = clave;
      refrescar = true;
    }
    if (!this.catalogosCache$ || refrescar) {
      const cache$: Observable<PlantillaCatalogos> = forkJoin([
        this.leer('Modalidades', null, () => this.modalidades.list().pipe(
          map((lista) => lista.map((m) => ({ id: m.id, nombre: m.activo ? m.nombre : `${m.nombre} (inactiva)` }))),
        )),
        this.leer('Categorías', null, () => this.categorias.list().pipe(map(opcionesDeCategoria))),
        this.leer('Etiquetas', LEER_ETIQUETAS, () => this.etiquetas.list().pipe(
          map((lista) => lista.map((e) => ({ id: e.id, nombre: e.local ? `${e.slug} (local)` : e.slug }))),
        )),
        this.leer('Destinatarios', null, () => this.destinatarios.list().pipe(
          map((lista) => lista.map((d) => ({ id: d.id, nombre: d.nombre }))),
        )),
        this.leer('Eventos de vida', null, () => this.eventosDeVida.list().pipe(
          map((lista) => lista.map((e) => ({ id: e.id, nombre: e.nombre }))),
        )),
      ]).pipe(
        tap((leidos) => {
          // Solo se invalida a sí misma: una lectura vieja que termina tarde no borra una más nueva.
          if (leidos.some((c) => !c.ok && c.reintentable) && this.catalogosCache$ === cache$) this.catalogosCache$ = null;
        }),
        map(([modalidades, categorias, etiquetas, destinatarios, eventosDeVida]): PlantillaCatalogos => ({
          modalidades: modalidades.items,
          categorias: categorias.items,
          etiquetas: etiquetas.items,
          destinatarios: destinatarios.items,
          eventosDeVida: eventosDeVida.items,
          noDisponibles: [modalidades, categorias, etiquetas, destinatarios, eventosDeVida]
            .filter((c) => !c.ok)
            .map((c) => c.nombre),
        })),
        shareReplay(1),
      );
      this.catalogosCache$ = cache$;
    }
    return this.catalogosCache$;
  }

  /**
   * Un catálogo que falla (red, permisos) no tumba la pantalla: la plantilla se ve igual, con
   * "No disponible" donde iba el nombre, y el form avisa qué catálogo falta. Sin `permiso` no se pide.
   */
  private leer(nombre: string, permiso: string | null, fuente: () => Observable<PlantillaOpcion[]>): Observable<CatalogoLeido> {
    if (permiso && !this.auth.can(permiso)) return of({ nombre, ok: false, reintentable: false, items: [] });
    return fuente().pipe(
      map((items): CatalogoLeido => ({ nombre, ok: true, reintentable: false, items })),
      catchError(() => of<CatalogoLeido>({ nombre, ok: false, reintentable: true, items: [] })),
    );
  }
}

/** Opciones de categoría con su ruta jerárquica, ordenadas por esa ruta. */
function opcionesDeCategoria(categorias: CategoriaVM[]): PlantillaOpcion[] {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const ruta = (categoria: CategoriaVM): string => {
    const tramos = [categoria.nombre];
    const vistos = new Set([categoria.id]);
    let padre = categoria.parentId ? porId.get(categoria.parentId) : undefined;
    // `vistos` corta un eventual ciclo de datos en vez de colgar la pantalla.
    while (padre && !vistos.has(padre.id)) {
      tramos.unshift(padre.nombre);
      vistos.add(padre.id);
      padre = padre.parentId ? porId.get(padre.parentId) : undefined;
    }
    return tramos.join(SEPARADOR_CATEGORIA);
  };
  return categorias
    .map((c) => ({ id: c.id, nombre: ruta(c) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR', { sensitivity: 'base' }));
}

/** Devuelve una función que completa los nombres de una plantilla con los catálogos dados. */
function resolvedorDeNombres(catalogos: PlantillaCatalogos): (p: PlantillaVM) => PlantillaVM {
  const indice = (opciones: PlantillaOpcion[]) => new Map(opciones.map((o) => [o.id, o.nombre]));
  const modalidades = indice(catalogos.modalidades);
  const categorias = indice(catalogos.categorias);
  const etiquetas = indice(catalogos.etiquetas);
  const destinatarios = indice(catalogos.destinatarios);
  const eventos = indice(catalogos.eventosDeVida);

  const nombrar = (r: PlantillaRef, nombres: Map<string, string>): PlantillaRef => ({ id: r.id, nombre: nombres.get(r.id) ?? null });

  return (p) => ({
    ...p,
    modalidad: p.modalidad ? nombrar(p.modalidad, modalidades) : null,
    categoriaPrincipal: p.categoriaPrincipal ? nombrar(p.categoriaPrincipal, categorias) : null,
    categorias: p.categorias.map((r) => nombrar(r, categorias)),
    etiquetas: p.etiquetas.map((r) => nombrar(r, etiquetas)),
    destinatarios: p.destinatarios.map((r) => nombrar(r, destinatarios)),
    eventosDeVida: p.eventosDeVida.map((r) => nombrar(r, eventos)),
  });
}
