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
import { TiposOrganismoFacade, TipoOrganismoVM } from '@features/tipos-organismo';

/** Textos del estado vacío: distinguen "todavía no hay nada" de "los filtros no matchean". */
interface EstadoVacio {
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
}

/** ViewModel de la pantalla: filas ya buscadas/filtradas/ordenadas + los textos que corresponden. */
interface TiposVista extends EstadoVacio {
  /** Solo la página visible. */
  rows: TipoOrganismoVM[];
  /** Total tras filtrar (lo que cuenta el toolbar y alimenta al paginador). */
  total: number;
  pageIndex: number;
  hayFiltros: boolean;
  filtrosActivos: FiltroActivo[];
}

@Component({
  selector: 'app-tipos-organismo-list',
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
  templateUrl: './tipos-organismo-list.component.html',
  styleUrls: ['./tipos-organismo-list.component.scss'],
})
export class TiposOrganismoListComponent implements OnInit {
  private readonly facade = inject(TiposOrganismoFacade);
  readonly tipos$ = this.facade.tipos$;

  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  /** Id del tipo con un borrado en vuelo, para bloquear su fila mientras dura. */
  deletingId: string | null = null;

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  /** Filtro "Todos/Activos/Inactivos" (campo real `activo`), client-side sobre el stream ya cargado. */
  readonly filtro$ = new BehaviorSubject<ActivoFiltro>('todos');
  readonly sort$ = new BehaviorSubject<TableSortEvent | null>(null);

  private readonly search$ = this.searchCtrl.valueChanges.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    startWith(this.searchCtrl.value),
  );

  /** Los contadores de los chips se calculan sobre lo ya buscado, para que no mientan. */
  readonly filterTabs$ = combineLatest([this.tipos$, this.search$]).pipe(
    map(([tipos, search]) => activoFilterTabs(this.buscar(tipos, search))),
  );

  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);

  readonly vista$ = combineLatest([
    this.tipos$, this.filtro$, this.search$, this.sort$, this.pageIndex$, this.pageSize$,
  ]).pipe(
    map(([tipos, filtro, search, sort, pageIndex, pageSize]): TiposVista => {
      const filtradas = this.ordenar(filterByActivo(this.buscar(tipos, search), filtro), sort);
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
        ...this.estadoVacio(tipos.length, hayFiltros),
      };
    }),
  );

  columns: TableColumn<TipoOrganismoVM>[] = [
    { key: 'nombre',      label: 'Nombre',      sortable: true },
    { key: 'descripcion', label: 'Descripción', sortable: true, hideOnMobile: true },
    { key: 'activo',      label: 'Activo',      sortable: true, width: '110px' },
    { key: 'acciones',    label: 'Acciones',    width: '140px' },
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
    this.facade.loadTipos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        // Sin esto la lista quedaría mostrando el estado vacío como si no hubiera
        // tipos, indistinguible de una carga fallida.
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
    this.router.navigate(['/dashboard/tipos-organismo/nuevo']);
  }

  accionEditar(tipo: TipoOrganismoVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_ORGANISM_TYPE',
      run: () => this.onEdit(tipo),
    };
  }

  accionesDe(tipo: TipoOrganismoVM): RowAction[] {
    return [{
      label: 'Eliminar',
      icon: 'trash',
      permission: 'DELETE_ORGANISM_TYPE',
      danger: true,
      ariaLabel: `Eliminar tipo de organismo ${tipo.nombre}`,
      run: () => this.onDelete(tipo),
    }];
  }

  onEdit(tipo: TipoOrganismoVM): void {
    this.router.navigate(['/dashboard/tipos-organismo/editar', tipo.id]);
  }

  onDelete(tipo: TipoOrganismoVM): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '¿Eliminar el tipo de organismo?',
        // Cuenta la consecuencia, no la restricción. Que no se pueda borrar un tipo con
        // organismos activos lo decide el backend y, si corresponde, vuelve como error:
        // adelantarlo acá solo agregaba ruido y mezclaba eliminar con desactivar.
        message: `Se eliminará ${tipo.nombre} y dejará de estar disponible para clasificar organismos. Esta acción no se puede deshacer.`,
        highlight: tipo.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando...',
        // El diálogo se queda abierto con el botón en spinner hasta que el backend
        // responde, en vez de cerrar optimistamente y dejar al usuario sin señal.
        confirmAction: () => {
          this.deletingId = tipo.id;
          this.cdr.markForCheck();
          return this.facade.delete(tipo.id).pipe(
            finalize(() => { this.deletingId = null; this.cdr.markForCheck(); }),
          );
        },
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open('Tipo de organismo eliminado', 'OK', {
        duration: 3000,
        // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
        panelClass: 'snackbar-success',
      }));
  }

  private buscar(tipos: TipoOrganismoVM[], termino: string): TipoOrganismoVM[] {
    return buscarEn(tipos, termino, (t) => [t.nombre, t.descripcion, t.code]);
  }

  private ordenar(tipos: TipoOrganismoVM[], sort: TableSortEvent | null): TipoOrganismoVM[] {
    if (!sort?.direction) return tipos;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...tipos].sort((a, b) =>
      this.valorDeOrden(a, sort.active)
        .localeCompare(this.valorDeOrden(b, sort.active), 'es-AR', { sensitivity: 'base' }) * factor,
    );
  }

  private valorDeOrden(tipo: TipoOrganismoVM, key: string): string {
    switch (key) {
      case 'nombre':      return tipo.nombre ?? '';
      case 'descripcion': return tipo.descripcion ?? '';
      case 'activo':      return tipo.activo ? 'Activo' : 'Inactivo';
      default:            return '';
    }
  }

  private filtrosActivos(search: string, filtro: ActivoFiltro): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    const termino = search.trim();
    if (termino) activos.push({ clave: 'search', etiqueta: `Búsqueda: ${termino}` });
    if (filtro !== 'todos') {
      activos.push({ clave: 'estado', etiqueta: `Estado: ${filtro === 'activos' ? 'Activos' : 'Inactivos'}` });
    }
    return activos;
  }

  private estadoVacio(total: number, hayFiltros: boolean): EstadoVacio {
    if (total > 0 && hayFiltros) {
      return {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ningún tipo de organismo coincide con la búsqueda o el filtro aplicado.',
        emptyActionLabel: 'Limpiar filtros',
      };
    }
    return {
      emptyTitle: 'Todavía no hay tipos de organismo',
      emptyMessage: 'Creá el primero para poder clasificar los organismos de la provincia.',
      emptyActionLabel: 'Nuevo tipo',
    };
  }
}
