import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, filter, finalize, map, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SharedTableComponent, TableCellDirective, TableColumn, TablePageEvent, TableSortEvent } from '../../../shared/components/table';
import { FilterTabsComponent } from '../../../shared/components/filter-tabs';
import { RowAction, RowActionsComponent } from '../../../shared/components/row-actions';
import { ListSearchComponent } from '../../../shared/components/list-search';
import { ActiveFiltersComponent, FiltroActivo } from '../../../shared/components/active-filters';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { ActivoFiltro, activoFilterTabs, buscarEn, filterByActivo } from '@core/utils/list-filter.utils';
import { EtiquetasFacade, EtiquetaVM } from '@features/etiquetas';

/** Textos del estado vacío: distinguen "todavía no hay nada" de "los filtros no matchean". */
interface EstadoVacio {
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
}

/** Concordancia de género de los chips del filtro `activo`, que el helper compartido rotula en masculino. */
const ETIQUETAS_TAB_LABELS: Record<string, string> = {
  todos: 'Todas',
  activos: 'Activas',
  inactivos: 'Inactivas',
};

/** ViewModel de la pantalla: filas ya buscadas/filtradas/ordenadas + los textos que corresponden. */
interface EtiquetasVista extends EstadoVacio {
  /** Solo la página visible. */
  rows: EtiquetaVM[];
  /** Total tras filtrar (lo que cuenta el toolbar y alimenta al paginador). */
  total: number;
  pageIndex: number;
  hayFiltros: boolean;
  filtrosActivos: FiltroActivo[];
}

@Component({
  selector: 'app-etiquetas-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    FilterTabsComponent,
    RowActionsComponent,
    ListSearchComponent,
    ActiveFiltersComponent,
    HasPermissionDirective,
    PageActionsDirective,
  ],
  templateUrl: './etiquetas-list.component.html',
  styleUrls: ['./etiquetas-list.component.scss'],
})
export class EtiquetasListComponent implements OnInit {
  private readonly facade = inject(EtiquetasFacade);
  readonly etiquetas$ = this.facade.etiquetas$;

  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  /** Id de la etiqueta con un borrado en vuelo, para bloquear su fila mientras dura. */
  deletingId: number | null = null;

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  /** Filtro "Todas/Activas/Inactivas" (campo real `activo`), client-side sobre el stream ya cargado. */
  readonly filtro$ = new BehaviorSubject<ActivoFiltro>('todos');
  readonly sort$ = new BehaviorSubject<TableSortEvent | null>(null);

  private readonly search$ = this.searchCtrl.valueChanges.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    startWith(this.searchCtrl.value),
  );

  /** Los contadores de los chips se calculan sobre lo ya buscado, para que no mientan. */
  readonly filterTabs$ = combineLatest([this.etiquetas$, this.search$]).pipe(
    map(([etiquetas, search]) => activoFilterTabs(this.buscar(etiquetas, search))
      // El helper es compartido y rotula en masculino; acá el sujeto es "etiqueta".
      .map((tab) => ({ ...tab, label: ETIQUETAS_TAB_LABELS[tab.value] ?? tab.label }))),
  );

  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);

  readonly vista$ = combineLatest([
    this.etiquetas$, this.filtro$, this.search$, this.sort$, this.pageIndex$, this.pageSize$,
  ]).pipe(
    map(([etiquetas, filtro, search, sort, pageIndex, pageSize]): EtiquetasVista => {
      const filtradas = this.ordenar(filterByActivo(this.buscar(etiquetas, search), filtro), sort);
      // Al filtrar, la página actual puede quedar fuera de rango: se acota en vez de
      // mostrar una tabla vacía con resultados que sí existen.
      const ultimaPagina = Math.max(0, Math.ceil(filtradas.length / pageSize) - 1);
      const pagina = Math.min(pageIndex, ultimaPagina);
      const desde = pagina * pageSize;

      const filtrosActivos = this.filtrosActivos(search, filtro);
      const hayFiltros = filtrosActivos.length > 0;
      return {
        rows: filtradas.slice(desde, desde + pageSize),
        total: filtradas.length,
        pageIndex: pagina,
        hayFiltros,
        filtrosActivos,
        ...this.estadoVacio(etiquetas.length, hayFiltros),
      };
    }),
  );

  columns: TableColumn<EtiquetaVM>[] = [
    { key: 'nombre',        label: 'Etiqueta', sortable: true },
    { key: 'slug',          label: 'Slug',     sortable: true, hideOnMobile: true },
    { key: 'tramitesCount', label: 'Trámites', sortable: true, width: '110px' },
    { key: 'activo',        label: 'Activa',   sortable: true, width: '110px' },
    { key: 'acciones',      label: 'Acciones', width: '140px' },
  ];

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.facade.loadEtiquetas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        // Sin esto la lista quedaría mostrando el estado vacío como si no hubiera
        // etiquetas, indistinguible de una carga fallida.
        error: () => { this.loading = false; this.error = true; this.cdr.markForCheck(); },
      });
  }

  limpiarFiltros(): void {
    this.searchCtrl.setValue('');
    this.filtro$.next('todos');
  }

  /** Quita un solo filtro desde su chip en la barra "Filtros activos". */
  quitarFiltro(clave: string): void {
    if (clave === 'search') this.searchCtrl.setValue('');
    else this.filtro$.next('todos');
  }

  hayFiltrosActivos(): boolean {
    return this.filtro$.value !== 'todos' || this.searchCtrl.value.trim().length > 0;
  }

  /** El CTA del estado vacío crea o limpia según por qué está vacío. */
  onEmptyAction(): void {
    if (this.hayFiltrosActivos()) {
      this.limpiarFiltros();
      return;
    }
    this.onCreate();
  }

  onSortChange(sort: TableSortEvent): void {
    this.sort$.next(sort);
  }

  onPageChange(evento: TablePageEvent): void {
    this.pageIndex$.next(evento.pageIndex);
    this.pageSize$.next(evento.pageSize);
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/etiquetas/nuevo']);
  }

  accionEditar(etiqueta: EtiquetaVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_TAXONOMY',
      run: () => this.onEdit(etiqueta),
    };
  }

  accionesDe(etiqueta: EtiquetaVM): RowAction[] {
    return [{
      label: 'Eliminar',
      icon: 'trash',
      permission: 'DELETE_TAXONOMY',
      danger: true,
      ariaLabel: `Eliminar etiqueta ${etiqueta.nombre}`,
      run: () => this.onDelete(etiqueta),
    }];
  }

  onEdit(etiqueta: EtiquetaVM): void {
    this.router.navigate(['/dashboard/etiquetas/editar', etiqueta.id]);
  }

  onDelete(etiqueta: EtiquetaVM): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '¿Eliminar la etiqueta?',
        // Cuenta la consecuencia con el dato que ya tenemos: cuántos trámites la usan.
        message: `Se eliminará ${etiqueta.nombre} y ${this.consecuencia(etiqueta)}. Esta acción no se puede deshacer.`,
        highlight: etiqueta.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando...',
        // El diálogo se queda abierto con el botón en spinner hasta que el backend
        // responde, en vez de cerrar optimistamente y dejar al usuario sin señal.
        confirmAction: () => {
          this.deletingId = etiqueta.id;
          this.cdr.markForCheck();
          return this.facade.delete(etiqueta.id).pipe(
            finalize(() => { this.deletingId = null; this.cdr.markForCheck(); }),
          );
        },
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open('Etiqueta eliminada', 'OK', {
        duration: 3000,
        // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
        panelClass: 'snackbar-success',
      }));
  }

  private consecuencia(etiqueta: EtiquetaVM): string {
    if (!etiqueta.tramitesCount) return 'dejará de estar disponible para clasificar trámites';
    return etiqueta.tramitesCount === 1
      ? 'se quitará del trámite que la usa'
      : `se quitará de los ${etiqueta.tramitesCount} trámites que la usan`;
  }

  private buscar(etiquetas: EtiquetaVM[], termino: string): EtiquetaVM[] {
    return buscarEn(etiquetas, termino, (e) => [e.nombre, e.slug]);
  }

  private ordenar(etiquetas: EtiquetaVM[], sort: TableSortEvent | null): EtiquetaVM[] {
    if (!sort?.direction) return etiquetas;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...etiquetas].sort((a, b) => this.comparar(a, b, sort.active) * factor);
  }

  private comparar(a: EtiquetaVM, b: EtiquetaVM, key: string): number {
    // `tramitesCount` es numérico: comparado como texto, "10" quedaría antes que "2".
    if (key === 'tramitesCount') return a.tramitesCount - b.tramitesCount;
    return this.valorDeOrden(a, key)
      .localeCompare(this.valorDeOrden(b, key), 'es-AR', { sensitivity: 'base' });
  }

  private valorDeOrden(etiqueta: EtiquetaVM, key: string): string {
    switch (key) {
      case 'nombre': return etiqueta.nombre ?? '';
      case 'slug':   return etiqueta.slug ?? '';
      case 'activo': return etiqueta.activo ? 'Activa' : 'Inactiva';
      default:       return '';
    }
  }

  private filtrosActivos(search: string, filtro: ActivoFiltro): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    const termino = search.trim();
    if (termino) activos.push({ clave: 'search', etiqueta: `Búsqueda: ${termino}` });
    if (filtro !== 'todos') {
      activos.push({ clave: 'estado', etiqueta: `Estado: ${filtro === 'activos' ? 'Activas' : 'Inactivas'}` });
    }
    return activos;
  }

  private estadoVacio(total: number, hayFiltros: boolean): EstadoVacio {
    if (total > 0 && hayFiltros) {
      return {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ninguna etiqueta coincide con la búsqueda o el filtro aplicado.',
        emptyActionLabel: 'Limpiar filtros',
      };
    }
    return {
      emptyTitle: 'Todavía no hay etiquetas',
      emptyMessage: 'Creá la primera para poder etiquetar los trámites del portal.',
      emptyActionLabel: 'Nueva etiqueta',
    };
  }
}
