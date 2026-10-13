import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, Observable, combineLatest, debounceTime, distinctUntilChanged, filter, finalize, map, merge, startWith,
} from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SharedTableComponent, TableCellDirective, TableColumn, TablePageEvent, TableSortEvent } from '../../../../shared/components/table';
import { RowAction, RowActionsComponent } from '../../../../shared/components/row-actions';
import { ListSearchComponent } from '../../../../shared/components/list-search';
import { ActiveFiltersComponent, FiltroActivo } from '../../../../shared/components/active-filters';
import { FilterTabOption, FilterTabsComponent } from '../../../../shared/components/filter-tabs';
import { EstadoBadgeComponent } from '../../../../shared/components/estado-badge/estado-badge.component';
import { AuthTokenService } from '@core/services/auth-token.service';
import { PUBLICACION_POLICY } from '@core/constants/policy-overrides.constants';
import { ESTADOS_PUBLICACION, ETIQUETA_ESTADO_PUBLICACION } from '@core/models/estado-publicacion.model';
import { buscarEn } from '@core/utils/list-filter.utils';
import { AccionWorkflow, EstadoFicha, FichaLocalVM, FichasLocalesFacade, accionesDisponibles } from '@features/fichas-locales';
import { ACCIONES_UI, confirmAccion, confirmDesactivar, nombreDeFicha } from '../ficha-textos';
import { NO_DISPONIBLE } from '../ficha-save-error';
import { RUTA_DETALLE_FICHA, RUTA_EDITAR_FICHA } from '../fichas.rutas';

type Tab = 'todas' | 'revision';

/** Orden del estado al ordenar la columna: el del workflow. */
const ORDEN_ESTADO: Record<EstadoFicha, number> = { BORRADOR: 0, EN_REVISION: 1, PUBLICADO: 2, DESPUBLICADO: 3 };

interface Opcion {
  id: string;
  nombre: string;
}

interface FichasVista {
  rows: FichaLocalVM[];
  total: number;
  pageIndex: number;
  hayFiltros: boolean;
  filtrosActivos: FiltroActivo[];
  emptyTitle: string;
  emptyMessage: string;
}

/**
 * "Fichas por localidad": todas las fichas del alcance (SA/MANAGER: todas; AO/AGENT: las de su
 * organismo). El backend devuelve la lista completa sin paginar ni filtrar: tabs, búsqueda, filtros,
 * orden y paginado son client-side sobre `fichas$`.
 *
 * - Tab "En revisión" (bandeja de publicación): solo con `PUBLISH_VARIANT`, con el contador de las
 *   activas pendientes. El nav no soporta badges: el contador vive acá.
 * - Las desactivadas (el backend las lista) se ocultan salvo con "Mostrar desactivadas".
 * - Las acciones de workflow de cada fila salen de `accionesDisponibles` (permiso, nunca rol: D-3).
 * - Las fichas no se crean desde acá: cuelgan de un trámite del organismo ("Agregar localidad").
 */
@Component({
  selector: 'app-fichas-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    RowActionsComponent,
    ListSearchComponent,
    ActiveFiltersComponent,
    FilterTabsComponent,
    EstadoBadgeComponent,
  ],
  templateUrl: './fichas-list.component.html',
  styleUrl: './fichas-list.component.scss',
})
export class FichasListComponent implements OnInit {
  private readonly facade = inject(FichasLocalesFacade);
  private readonly auth = inject(AuthTokenService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly fichas$ = this.facade.fichas$;
  readonly rutaDetalle = RUTA_DETALLE_FICHA;
  readonly noDisponible = NO_DISPONIBLE;
  readonly estados = ESTADOS_PUBLICACION.map((valor) => ({ valor, etiqueta: ETIQUETA_ESTADO_PUBLICACION[valor] }));

  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  /** Ficha con una acción en vuelo, para bloquear su fila mientras dura. */
  ocupadaId: string | null = null;

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  /** '' = todos. */
  readonly estadoCtrl = new FormControl<EstadoFicha | ''>('', { nonNullable: true });
  readonly localidadCtrl = new FormControl('', { nonNullable: true });
  readonly inactivasCtrl = new FormControl(false, { nonNullable: true });
  readonly tab$ = new BehaviorSubject<Tab>('todas');
  readonly sort$ = new BehaviorSubject<TableSortEvent | null>(null);
  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);

  /** Reactivo a la sesión: la bandeja "En revisión" es de quien puede publicar (`PUBLISH_VARIANT`). */
  readonly puedePublicar$: Observable<boolean> = this.auth.getCurrentUser$().pipe(
    map(() => this.auth.can('PUBLISH_VARIANT')),
    distinctUntilChanged(),
  );

  private readonly search$ = this.searchCtrl.valueChanges.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    startWith(this.searchCtrl.value),
  );
  private readonly estado$ = this.estadoCtrl.valueChanges.pipe(startWith(this.estadoCtrl.value));
  private readonly localidad$ = this.localidadCtrl.valueChanges.pipe(startWith(this.localidadCtrl.value));
  private readonly inactivas$ = this.inactivasCtrl.valueChanges.pipe(startWith(this.inactivasCtrl.value));

  /** Sin `PUBLISH_VARIANT` la tab de revisión no existe: se trata como "todas". */
  private readonly tabEfectiva$ = combineLatest([this.tab$, this.puedePublicar$]).pipe(
    map(([tab, puede]): Tab => (puede ? tab : 'todas')),
  );

  /** Localidades con nombre que aparecen en la lista (sin nombre no hay filtro que ofrecer). */
  readonly localidades$ = this.fichas$.pipe(map(localidadesDeFiltro));

  readonly filterTabs$: Observable<FilterTabOption[]> = combineLatest([this.fichas$, this.puedePublicar$]).pipe(
    map(([fichas, puede]) => {
      if (!puede) return [];
      const enRevision = fichas.filter((f) => f.activa && f.estado === 'EN_REVISION').length;
      return [
        { value: 'todas', label: 'Todas' },
        { value: 'revision', label: 'En revisión', count: enRevision, alert: enRevision > 0 },
      ];
    }),
  );

  readonly vista$: Observable<FichasVista> = combineLatest([
    this.fichas$, this.localidades$, this.tabEfectiva$, this.search$, this.estado$, this.localidad$, this.inactivas$,
    this.sort$, this.pageIndex$, this.pageSize$,
  ]).pipe(
    map(([fichas, localidades, tab, search, estado, localidadId, inactivas, sort, pageIndex, pageSize]): FichasVista => {
      const filtradas = this.ordenar(
        fichas
          .filter((f) => inactivas || f.activa)
          .filter((f) => tab !== 'revision' || (f.activa && f.estado === 'EN_REVISION'))
          .filter((f) => !estado || f.estado === estado)
          .filter((f) => !localidadId || f.localidadId === localidadId)
          .filter((f) => buscarEn([f], search, (x) => [x.plantillaTitulo, x.organismoNombre, x.localidadNombre, x.slug]).length > 0),
        sort,
      );
      // Al filtrar, la página actual puede quedar fuera de rango: se acota.
      const ultimaPagina = Math.max(0, Math.ceil(filtradas.length / pageSize) - 1);
      const pagina = Math.min(pageIndex, ultimaPagina);
      const desde = pagina * pageSize;

      const filtrosActivos = this.filtrosActivos(search, estado, localidadId, inactivas, localidades);
      const hayFiltros = filtrosActivos.length > 0;
      return {
        rows: filtradas.slice(desde, desde + pageSize),
        total: filtradas.length,
        pageIndex: pagina,
        hayFiltros,
        filtrosActivos,
        ...this.textosVacio(fichas.length > 0, hayFiltros, tab),
      };
    }),
  );

  readonly columns: TableColumn<FichaLocalVM>[] = [
    { key: 'tramite', label: 'Trámite', sortable: true },
    { key: 'localidad', label: 'Localidad', sortable: true, hideOnMobile: true },
    { key: 'estado', label: 'Estado', sortable: true, width: '170px' },
    { key: 'version', label: 'Versión', sortable: true, width: '90px', hideOnMobile: true },
    { key: 'acciones', label: 'Acciones', width: '140px' },
  ];

  ngOnInit(): void {
    this.load();

    // `?tab=revision` (buscador de comandos) abre la bandeja.
    this.route.queryParamMap
      .pipe(map((params) => params.get('tab')), takeUntilDestroyed(this.destroyRef))
      .subscribe((tab) => this.tab$.next(tab === 'revision' ? 'revision' : 'todas'));

    // Cambiar un filtro o la tab vuelve a la primera página.
    merge(
      this.searchCtrl.valueChanges, this.estadoCtrl.valueChanges, this.localidadCtrl.valueChanges,
      this.inactivasCtrl.valueChanges, this.tab$,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.pageIndex$.next(0));

    // Una localidad elegida que ya no está en la lista deja de filtrar.
    this.localidades$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((localidades) => {
        const elegida = this.localidadCtrl.value;
        // Mientras recarga la lista está vacía: no es que la localidad haya desaparecido.
        if (this.loading || !localidades.length) return;
        if (elegida && !localidades.some((l) => l.id === elegida)) this.localidadCtrl.setValue('');
      });
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.facade.loadFichas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        error: () => { this.loading = false; this.error = true; this.cdr.markForCheck(); },
      });
  }

  cambiarTab(tab: string): void {
    this.tab$.next(tab === 'revision' ? 'revision' : 'todas');
  }

  limpiarFiltros(): void {
    this.searchCtrl.setValue('');
    this.estadoCtrl.setValue('');
    this.localidadCtrl.setValue('');
    this.inactivasCtrl.setValue(false);
  }

  quitarFiltro(clave: string): void {
    if (clave === 'search') this.searchCtrl.setValue('');
    if (clave === 'estado') this.estadoCtrl.setValue('');
    if (clave === 'localidad') this.localidadCtrl.setValue('');
    if (clave === 'inactivas') this.inactivasCtrl.setValue(false);
  }

  onSortChange(sort: TableSortEvent): void {
    this.sort$.next(sort);
  }

  onPageChange(evento: TablePageEvent): void {
    this.pageIndex$.next(evento.pageIndex);
    this.pageSize$.next(evento.pageSize);
  }

  accionVer(ficha: FichaLocalVM): RowAction {
    return {
      label: 'Ver detalle',
      icon: 'eye',
      permission: 'READ_VARIANT',
      ariaLabel: `Ver la ficha ${nombreDeFicha(ficha)}`,
      run: () => this.router.navigate([RUTA_DETALLE_FICHA, ficha.id]),
    };
  }

  /**
   * Menú de la fila: editar, las acciones de workflow que correspondan al estado y desactivar. El
   * permiso lo vuelve a filtrar `app-row-actions` (y se recalcula en cada detección de cambios).
   */
  accionesDe(ficha: FichaLocalVM): RowAction[] {
    const workflow = accionesDisponibles(ficha.estado, (p) => this.auth.can(p), {
      activa: ficha.activa,
      permitirEnviarYPublicar: PUBLICACION_POLICY.permitirEnviarYPublicar,
    }).map((accion): RowAction => ({
      label: ACCIONES_UI[accion].label,
      icon: ACCIONES_UI[accion].icon,
      danger: ACCIONES_UI[accion].danger,
      ariaLabel: `${ACCIONES_UI[accion].label}: ${nombreDeFicha(ficha)}`,
      run: () => this.onAccion(ficha, accion),
    }));

    const acciones: RowAction[] = [
      {
        label: 'Editar',
        icon: 'pencil-simple',
        permission: 'UPDATE_VARIANT',
        ariaLabel: `Editar la ficha ${nombreDeFicha(ficha)}`,
        run: () => this.router.navigate([RUTA_EDITAR_FICHA, ficha.id]),
      },
      ...workflow,
    ];
    if (ficha.activa) {
      acciones.push({
        label: 'Desactivar',
        icon: 'prohibit',
        permission: 'UPDATE_VARIANT',
        danger: true,
        ariaLabel: `Desactivar la ficha ${nombreDeFicha(ficha)}`,
        run: () => this.onDesactivar(ficha),
      });
    }
    return acciones;
  }

  onAccion(ficha: FichaLocalVM, accion: AccionWorkflow): void {
    this.confirmar(
      confirmAccion(ficha, accion, () => this.ocupar(ficha.id, this.facade.ejecutar(ficha.id, accion))),
      ACCIONES_UI[accion].exito,
    );
  }

  onDesactivar(ficha: FichaLocalVM): void {
    this.confirmar(
      confirmDesactivar(ficha, () => this.ocupar(ficha.id, this.facade.desactivar(ficha.id))),
      'Ficha desactivada',
    );
  }

  private confirmar(data: ConfirmDialogData, exito: string): void {
    this.dialog.open(ConfirmDialogComponent, { data, panelClass: 'custom-modal-panel' })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open(exito, 'OK', { duration: 3000, panelClass: 'snackbar-success' }));
  }

  /** Bloquea la fila mientras la acción corre. */
  private ocupar<T>(id: string, accion$: Observable<T>): Observable<T> {
    this.ocupadaId = id;
    this.cdr.markForCheck();
    return accion$.pipe(finalize(() => { this.ocupadaId = null; this.cdr.markForCheck(); }));
  }

  private textosVacio(hayFichas: boolean, hayFiltros: boolean, tab: Tab): { emptyTitle: string; emptyMessage: string } {
    if (hayFichas && hayFiltros) {
      return { emptyTitle: 'Sin resultados', emptyMessage: 'Ninguna ficha coincide con la búsqueda o los filtros aplicados.' };
    }
    if (hayFichas && tab === 'revision') {
      return { emptyTitle: 'No hay fichas en revisión', emptyMessage: 'Cuando alguien envíe una ficha a revisión, va a aparecer acá para publicarla.' };
    }
    return {
      emptyTitle: 'Todavía no hay fichas por localidad',
      emptyMessage: 'Una ficha dice cómo se hace un trámite del organismo en una localidad. Se agregan desde el detalle del trámite del organismo.',
    };
  }

  private ordenar(fichas: FichaLocalVM[], sort: TableSortEvent | null): FichaLocalVM[] {
    if (!sort?.direction) return fichas;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...fichas].sort((a, b) => this.comparar(a, b, sort.active) * factor);
  }

  private comparar(a: FichaLocalVM, b: FichaLocalVM, key: string): number {
    const texto = (x: string | null, y: string | null) => (x ?? '').localeCompare(y ?? '', 'es-AR', { sensitivity: 'base' });
    switch (key) {
      case 'tramite': return texto(a.plantillaTitulo ?? a.slug, b.plantillaTitulo ?? b.slug);
      case 'localidad': return texto(a.localidadNombre, b.localidadNombre);
      case 'estado': return ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado];
      case 'version': return a.version - b.version;
      default: return 0;
    }
  }

  private filtrosActivos(
    search: string, estado: EstadoFicha | '', localidadId: string, inactivas: boolean, localidades: Opcion[],
  ): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    const termino = search.trim();
    if (termino) activos.push({ clave: 'search', etiqueta: `Búsqueda: ${termino}` });
    if (estado) activos.push({ clave: 'estado', etiqueta: `Estado: ${ETIQUETA_ESTADO_PUBLICACION[estado]}` });
    if (localidadId) {
      const nombre = localidades.find((l) => l.id === localidadId)?.nombre ?? NO_DISPONIBLE;
      activos.push({ clave: 'localidad', etiqueta: `Localidad: ${nombre}` });
    }
    if (inactivas) activos.push({ clave: 'inactivas', etiqueta: 'Incluye desactivadas' });
    return activos;
  }
}

/** Localidades con nombre que usa al menos una ficha, sin repetir y ordenadas. */
function localidadesDeFiltro(fichas: FichaLocalVM[]): Opcion[] {
  const localidades = new Map<string, string>();
  for (const f of fichas) {
    if (f.localidadId && f.localidadNombre) localidades.set(f.localidadId, f.localidadNombre);
  }
  return [...localidades]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR', { sensitivity: 'base' }));
}
