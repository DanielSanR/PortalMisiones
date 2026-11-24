import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import {
  BehaviorSubject, Observable, combineLatest, debounceTime, distinctUntilChanged, map, of, startWith, take,
} from 'rxjs';
import { PreferenciasService } from '@core/services/preferencias.service';
import type { FiltroActivo } from '../components/active-filters';
import type { TablePageEvent, TableSortEvent } from '../components/table';
import { buscarEn } from './list-filter.utils';

/** Textos del estado vacío de `app-shared-table`: distinguen "todavía no hay nada" de "los filtros no coinciden". */
export interface TextosDeVacio {
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
}

/** Lo que la pantalla necesita para dibujarse: se consume con `@if (lista.vista$ | async; as vista)`. */
export interface VistaDeLista<T, F = undefined> {
  /** Solo la página visible (todas las filas si la lista no pagina). */
  rows: T[];
  /** Total tras buscar y filtrar: lo que cuenta el toolbar y alimenta al paginador. */
  total: number;
  /** Página que se muestra: la pedida (la primera tras buscar, filtrar u ordenar), acotada a la última que existe. */
  pageIndex: number;
  pageSize: number;
  /** Hay una carga en vuelo. */
  cargando: boolean;
  /** La última carga falló: la tabla muestra su error con "Reintentar" en vez del vacío. */
  error: boolean;
  /** Hay búsqueda o algún filtro aplicado. */
  hayFiltros: boolean;
  /** Chips de "Filtros activos": la búsqueda (clave `search`) y los de `filtrosActivos`. */
  filtrosActivos: FiltroActivo[];
  /** Fila con una acción en vuelo (`ocupar`), para bloquearla mientras dura. */
  ocupadaId: string | null;
  /** Último valor de `filtros$`. */
  filtros: F;
}

/** Con qué se calculan los chips, los textos del vacío y los datos extra de la vista. */
export interface ContextoDeLista<T, F> {
  /** Todo lo cargado, sin buscar ni filtrar. */
  items: T[];
  /** Lo que queda tras la búsqueda (antes de los filtros): sobre esto se cuentan las tabs. */
  buscadas: T[];
  filtros: F;
  hayFiltros: boolean;
}

export interface ListaClienteConfig<T, F, V extends object> {
  /** Lista completa del facade (`facade.xxx$`). El backend la devuelve sin paginar ni filtrar. */
  fuente$: Observable<T[]>;
  /** Pide la lista (`() => facade.loadX()`). El resultado no se usa: llega por `fuente$`. */
  cargar: () => Observable<unknown>;
  /** Campos de cada fila en los que busca el buscador. */
  buscarEn: (item: T) => (string | null | undefined)[];
  /** Orden por columna (`TableColumn.key`). Con textos, armalo con `compararPorTexto`. Sin él no se ordena. */
  comparar?: (a: T, b: T, columna: string) => number;
  /**
   * Filtros propios de la pantalla (tabs, selects), ya combinados en un stream que emite al suscribirse.
   * Su valor (o, si es un objeto, sus campos de texto, número o booleano) es el criterio: cuando cambia, la lista
   * vuelve a la primera página. Los arrays y objetos que viajen adentro (catálogos para armar los chips) son datos
   * de apoyo y no cuentan: se recalculan en cada recarga, y una recarga conserva la página.
   */
  filtros$?: Observable<F>;
  /** Aplica `filtros$` a lo ya buscado. */
  filtrar?: (buscadas: T[], filtros: F, items: T[]) => T[];
  /** Chips de los filtros aplicados (sin el de la búsqueda, que lo pone la lista). */
  filtrosActivos?: (filtros: F, items: T[]) => FiltroActivo[];
  /** Vuelve los filtros propios a su valor inicial ("Limpiar todo" y el CTA del vacío por filtros). */
  limpiarFiltros?: () => void;
  /**
   * Quita un filtro propio desde su chip (la clave `search` la resuelve la lista). Sin declararlo se usa
   * `limpiarFiltros`: en una lista con un solo filtro propio, quitar su chip es limpiarlo. Con dos o más, declaralo.
   */
  quitarFiltro?: (clave: string) => void;
  /** Textos del vacío y cualquier dato más que la vista necesite. Con dos juegos de textos: `textosDeVacio`. */
  extras: (contexto: ContextoDeLista<T, F>) => V;
  /** Filas por página (por defecto, la preferencia "Filas por página"). `null`: la lista no pagina. */
  tamanoDePagina?: number | null;
  /** La lista terminó de cargar (`true`) o empezó a cargar (`false`): `DialogoEnLista.listaLista`. */
  alCargar?: (lista: boolean) => void;
}

/** `extras` para el caso común: un juego de textos sin filtros (invita a crear) y otro con filtros (invita a limpiar). */
export function textosDeVacio(sinDatos: TextosDeVacio, sinResultados: TextosDeVacio): (contexto: { hayFiltros: boolean }) => TextosDeVacio {
  // Con filtros activos el CTA siempre limpia (aunque el dataset esté vacío): "Nuevo…" solo sin filtros.
  return ({ hayFiltros }) => (hayFiltros ? sinResultados : sinDatos);
}

/** Compara dos textos como los ordena una persona: es-AR, sin distinguir mayúsculas ni tildes; `null` = vacío. */
export function compararTexto(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? '').localeCompare(b ?? '', 'es-AR', { sensitivity: 'base' });
}

/** `comparar` para listas que ordenan todas sus columnas por un texto: `valor(fila, columna)`. */
export function compararPorTexto<T>(valor: (item: T, columna: string) => string | null | undefined): (a: T, b: T, columna: string) => number {
  return (a, b, columna) => compararTexto(valor(a, columna), valor(b, columna));
}

/** El criterio de unos filtros: su valor si es simple o, de un objeto, solo sus campos simples (ver `filtros$`). */
function criterioDe(filtros: unknown): unknown {
  if (typeof filtros !== 'object' || filtros === null) return filtros;
  return Object.entries(filtros).filter(([, valor]) => typeof valor !== 'object' || valor === null);
}

/**
 * Lista en cliente: búsqueda, filtros, orden, paginado, estado de carga y fila ocupada sobre una lista
 * que el backend devuelve completa. Junta lo que cada `*-list.component.ts` repetía (`searchCtrl`,
 * `sort$`, `pageIndex$`, acotar la página, chips, vacío por filtros, `loading` / `error` + `markForCheck`).
 *
 * Paginado: cambiar la búsqueda, un filtro o el orden vuelve a la primera página. Cambiar de página o de
 * tamaño no, y una recarga (tras un alta, una edición o una baja) conserva la página, acotada a la última que exista.
 * El tamaño inicial es `config.tamanoDePagina` o, sin él, la preferencia "Filas por página" (`PreferenciasService`),
 * leída una vez al crear la lista: cambiar la preferencia aplica a la próxima lista que se abra, no a la que está a la vista.
 *
 * Se crea en un inicializador de campo del componente (usa `inject`) y la pantalla consume `vista$`:
 *
 *   readonly lista = new ListaCliente({
 *     fuente$: this.facade.modalidades$,
 *     cargar: () => this.facade.loadModalidades(),
 *     buscarEn: (m) => [m.nombre],
 *     comparar: compararPorTexto((m) => m.nombre),
 *     extras: textosDeVacio({ … }, { … }),
 *     alCargar: (lista) => this.dialogo.listaLista(lista),
 *   });
 *   ngOnInit() { this.lista.cargar(); }
 *
 *   @if (lista.vista$ | async; as vista) {
 *     <app-shared-table [data]="vista.rows" [loading]="vista.cargando" [error]="vista.error" (retry)="lista.cargar()"
 *       (sortChange)="lista.ordenar($event)" [pageIndex]="vista.pageIndex" (pageChange)="lista.paginar($event)" …>
 *   }
 */
export class ListaCliente<T, F = undefined, V extends object = TextosDeVacio> {
  private readonly destroyRef = inject(DestroyRef);
  private readonly preferencias = inject(PreferenciasService);

  /** Control del buscador (`<app-list-search [control]="lista.searchCtrl">`). */
  readonly searchCtrl = new FormControl('', { nonNullable: true });

  /** Orden y tamaño de página. La página pedida va aparte (`paginaPedida`): también la mueve un cambio de criterio. */
  private readonly tabla$ = new BehaviorSubject<{ orden: TableSortEvent | null; tamano: number | null }>({
    orden: null,
    tamano: this.preferencias.actual.filasPorPagina,
  });
  private paginaPedida = 0;
  /** Búsqueda y filtros con los que se calculó la última vista: si cambian, se vuelve a la primera página. */
  private criterio = '';
  private readonly carga$ = new BehaviorSubject<{ cargando: boolean; error: boolean }>({ cargando: true, error: false });
  private readonly ocupadaId$ = new BehaviorSubject<string | null>(null);

  private readonly busqueda$: Observable<string>;
  private readonly filtros$: Observable<F>;
  /** Hay algún filtro propio aplicado (sin contar la búsqueda). Se lee a pedido: no guarda nada. */
  private readonly hayFiltrosPropios$: Observable<boolean>;

  /** Lo cargado tras la búsqueda y antes de los filtros: para contar las tabs sin que mientan. */
  readonly buscadas$: Observable<T[]>;
  readonly vista$: Observable<VistaDeLista<T, F> & V>;

  constructor(private readonly config: ListaClienteConfig<T, F, V>) {
    if (config.tamanoDePagina !== undefined) this.tabla$.next({ orden: null, tamano: config.tamanoDePagina });

    this.busqueda$ = this.searchCtrl.valueChanges.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      startWith(this.searchCtrl.value),
    );
    this.filtros$ = config.filtros$ ?? of(undefined as F);
    this.buscadas$ = combineLatest([config.fuente$, this.busqueda$]).pipe(
      map(([items, termino]) => buscarEn(items, termino, config.buscarEn)),
    );
    this.hayFiltrosPropios$ = combineLatest([config.fuente$, this.filtros$]).pipe(
      map(([items, filtros]) => this.filtrosPropios(filtros, items).length > 0),
    );

    this.vista$ = combineLatest([
      config.fuente$, this.filtros$, this.busqueda$, this.tabla$, this.carga$, this.ocupadaId$,
    ]).pipe(
      map(([items, filtros, termino, tabla, carga, ocupadaId]) =>
        this.calcular(items, filtros, termino, tabla.orden, tabla.tamano, carga, ocupadaId)),
    );
  }

  /** Hay una carga en vuelo (lectura sincrónica, para decidir dentro de una suscripción). */
  get cargando(): boolean {
    return this.carga$.value.cargando;
  }

  /** Pide la lista: carga inicial, "Reintentar" y recarga. */
  cargar(): void {
    this.carga$.next({ cargando: true, error: false });
    this.config.alCargar?.(false);
    this.config.cargar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.carga$.next({ cargando: false, error: false });
          this.config.alCargar?.(true);
        },
        // Sin esto la lista quedaría mostrando el estado vacío, indistinguible de una carga fallida.
        error: () => this.carga$.next({ cargando: false, error: true }),
      });
  }

  /** `(sortChange)` de la tabla. */
  ordenar(orden: TableSortEvent): void {
    this.paginaPedida = 0;
    this.tabla$.next({ ...this.tabla$.value, orden });
  }

  /** `(pageChange)` de la tabla. */
  paginar(evento: TablePageEvent): void {
    const tabla = this.tabla$.value;
    if (tabla.tamano === null) return;
    this.paginaPedida = evento.pageIndex;
    this.tabla$.next({ ...tabla, tamano: evento.pageSize });
  }

  /** Quita la búsqueda y todos los filtros ("Limpiar todo"). */
  limpiar(): void {
    this.searchCtrl.setValue('');
    this.config.limpiarFiltros?.();
  }

  /** Quita un solo filtro desde su chip en la barra "Filtros activos". */
  quitar(clave: string): void {
    if (clave === 'search') this.searchCtrl.setValue('');
    else if (this.config.quitarFiltro) this.config.quitarFiltro(clave);
    else this.config.limpiarFiltros?.();
  }

  /** El CTA del estado vacío limpia o crea según por qué está vacío. Mira lo que hay escrito ahora, no lo ya buscado. */
  accionDeVacio(crear: () => void): void {
    // `fuente$` y `filtros$` emiten al suscribirse (son los mismos que dibujaron el vacío): resuelve en el acto.
    this.hayFiltrosPropios$
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((hayFiltrosPropios) => {
        if (hayFiltrosPropios || this.searchCtrl.value.trim().length > 0) this.limpiar();
        else crear();
      });
  }

  /**
   * Para `confirmarBaja({ ocupado: this.lista.ocupar(fila.id) })`: bloquea la fila mientras corre la acción
   * (`vista.ocupadaId`) y la libera al terminar.
   */
  ocupar(id: string): (ocupado: boolean) => void {
    return (ocupado) => this.ocupadaId$.next(ocupado ? id : null);
  }

  private calcular(
    items: T[], filtros: F, termino: string, orden: TableSortEvent | null,
    tamano: number | null, carga: { cargando: boolean; error: boolean }, ocupadaId: string | null,
  ): VistaDeLista<T, F> & V {
    const { config } = this;
    const buscadas = buscarEn(items, termino, config.buscarEn);
    const filtradas = this.ordenadas(config.filtrar ? config.filtrar(buscadas, filtros, items) : buscadas, orden);

    const busqueda = termino.trim();
    const propios = this.filtrosPropios(filtros, items);
    const filtrosActivos: FiltroActivo[] = [
      ...(busqueda ? [{ clave: 'search', etiqueta: `Búsqueda: ${busqueda}` }] : []),
      ...propios,
    ];
    const hayFiltros = filtrosActivos.length > 0;

    // Otra búsqueda u otros filtros son otra lista: se empieza por su primera página. Va acá, y no en una
    // suscripción aparte, para que la vista nunca salga con el criterio nuevo y la página vieja.
    const criterio = JSON.stringify([busqueda, criterioDe(filtros)]);
    if (criterio !== this.criterio) {
      this.criterio = criterio;
      this.paginaPedida = 0;
    }

    let rows = filtradas;
    let pageIndex = 0;
    if (tamano !== null) {
      // Tras una recarga la página pedida puede quedar fuera de rango (se borró su última fila): se acota en
      // vez de mostrar una tabla vacía con resultados que sí existen.
      const ultimaPagina = Math.max(0, Math.ceil(filtradas.length / tamano) - 1);
      pageIndex = Math.min(this.paginaPedida, ultimaPagina);
      rows = filtradas.slice(pageIndex * tamano, (pageIndex + 1) * tamano);
    }

    return {
      rows,
      total: filtradas.length,
      pageIndex,
      pageSize: tamano ?? filtradas.length,
      cargando: carga.cargando,
      error: carga.error,
      hayFiltros,
      filtrosActivos,
      ocupadaId,
      filtros,
      ...config.extras({ items, buscadas, filtros, hayFiltros }),
    };
  }

  /** Chips de los filtros propios aplicados (sin el de la búsqueda). */
  private filtrosPropios(filtros: F, items: T[]): FiltroActivo[] {
    return this.config.filtrosActivos?.(filtros, items) ?? [];
  }

  private ordenadas(items: T[], orden: TableSortEvent | null): T[] {
    const comparar = this.config.comparar;
    if (!comparar || !orden?.direction) return items;
    const factor = orden.direction === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => comparar(a, b, orden.active) * factor);
  }
}
