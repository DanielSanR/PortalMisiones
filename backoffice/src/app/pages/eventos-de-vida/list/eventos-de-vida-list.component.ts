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
import { buscarEn, todasOnlyTabs } from '@core/utils/list-filter.utils';
import { EventosDeVidaFacade, EventoDeVidaVM } from '@features/eventos-de-vida';

/** Textos del estado vacío: distinguen "todavía no hay nada" de "los filtros no matchean". */
interface EstadoVacio {
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
}

/** ViewModel de la pantalla: filas ya buscadas/ordenadas + los textos que corresponden. */
interface EventosVista extends EstadoVacio {
  /** Solo la página visible. */
  rows: EventoDeVidaVM[];
  /** Total tras filtrar (lo que cuenta el toolbar y alimenta al paginador). */
  total: number;
  pageIndex: number;
  hayFiltros: boolean;
  filtrosActivos: FiltroActivo[];
}

@Component({
  selector: 'app-eventos-de-vida-list',
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
  templateUrl: './eventos-de-vida-list.component.html',
  styleUrls: ['./eventos-de-vida-list.component.scss'],
})
export class EventosDeVidaListComponent implements OnInit {
  private readonly facade = inject(EventosDeVidaFacade);
  readonly eventos$ = this.facade.eventos$;

  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  /** Id del evento con un borrado en vuelo, para bloquear su fila mientras dura. */
  deletingId: string | null = null;

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  readonly sort$ = new BehaviorSubject<TableSortEvent | null>(null);

  private readonly search$ = this.searchCtrl.valueChanges.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    startWith(this.searchCtrl.value),
  );

  /**
   * `EventoDeVidaVM` no tiene ningún campo con el que segmentar (solo id, slug y nombre):
   * un único chip "Todas" con el contador, sin fabricar filtros que no existen.
   * El contador se calcula sobre lo ya buscado, para que no mienta.
   */
  readonly filterTabs$ = combineLatest([this.eventos$, this.search$]).pipe(
    map(([eventos, search]) => todasOnlyTabs(this.buscar(eventos, search).length)),
  );

  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);

  readonly vista$ = combineLatest([
    this.eventos$, this.search$, this.sort$, this.pageIndex$, this.pageSize$,
  ]).pipe(
    map(([eventos, search, sort, pageIndex, pageSize]): EventosVista => {
      const filtradas = this.ordenar(this.buscar(eventos, search), sort);
      // Al buscar, la página actual puede quedar fuera de rango: se acota en vez de
      // mostrar una tabla vacía con resultados que sí existen.
      const ultimaPagina = Math.max(0, Math.ceil(filtradas.length / pageSize) - 1);
      const pagina = Math.min(pageIndex, ultimaPagina);
      const desde = pagina * pageSize;

      const filtrosActivos = this.filtrosActivos(search);
      const hayFiltros = filtrosActivos.length > 0;
      return {
        rows: filtradas.slice(desde, desde + pageSize),
        total: filtradas.length,
        pageIndex: pagina,
        hayFiltros,
        filtrosActivos,
        ...this.estadoVacio(hayFiltros),
      };
    }),
  );

  columns: TableColumn<EventoDeVidaVM>[] = [
    { key: 'nombre',   label: 'Evento de Vida', sortable: true },
    { key: 'slug',     label: 'Slug',           sortable: true, hideOnMobile: true },
    { key: 'acciones', label: 'Acciones',       width: '140px' },
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
    this.facade.loadEventos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        // Sin esto la lista quedaba mostrando el estado vacío como si no hubiera
        // eventos de vida, indistinguible de una carga fallida.
        error: () => { this.loading = false; this.error = true; this.cdr.markForCheck(); },
      });
  }

  limpiarFiltros(): void {
    this.searchCtrl.setValue('');
  }

  /** Quita un solo filtro desde su chip en la barra "Filtros activos". */
  quitarFiltro(clave: string): void {
    if (clave === 'search') this.searchCtrl.setValue('');
  }

  hayFiltrosActivos(): boolean {
    return this.searchCtrl.value.trim().length > 0;
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
    this.router.navigate(['/dashboard/eventos-de-vida/nuevo']);
  }

  accionEditar(evento: EventoDeVidaVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_LIFE_EVENT',
      run: () => this.onEdit(evento),
    };
  }

  accionesDe(evento: EventoDeVidaVM): RowAction[] {
    return [{
      label: 'Eliminar',
      icon: 'trash',
      permission: 'DELETE_LIFE_EVENT',
      danger: true,
      ariaLabel: `Eliminar evento de vida ${evento.nombre}`,
      run: () => this.onDelete(evento),
    }];
  }

  onEdit(evento: EventoDeVidaVM): void {
    this.router.navigate(['/dashboard/eventos-de-vida/editar', evento.id]);
  }

  onDelete(evento: EventoDeVidaVM): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '¿Eliminar el evento de vida?',
        // Cuenta la consecuencia. Si el backend rechaza el borrado por tener trámites
        // asociados, eso vuelve como error: adelantarlo acá sería inventar una regla.
        message: `Se eliminará ${evento.nombre} y dejará de estar disponible para agrupar trámites en el portal. Esta acción no se puede deshacer.`,
        highlight: evento.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando...',
        // El diálogo se queda abierto con el botón en spinner hasta que el backend
        // responde: antes cerraba primero y el borrado fallido no tenía dónde contarse.
        confirmAction: () => {
          this.deletingId = evento.id;
          this.cdr.markForCheck();
          return this.facade.delete(evento.id).pipe(
            finalize(() => { this.deletingId = null; this.cdr.markForCheck(); }),
          );
        },
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open('Evento de vida eliminado', 'OK', {
        duration: 3000,
        // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
        panelClass: 'snackbar-success',
      }));
  }

  private buscar(eventos: EventoDeVidaVM[], termino: string): EventoDeVidaVM[] {
    return buscarEn(eventos, termino, (e) => [e.nombre, e.slug]);
  }

  private ordenar(eventos: EventoDeVidaVM[], sort: TableSortEvent | null): EventoDeVidaVM[] {
    if (!sort?.direction) return eventos;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...eventos].sort((a, b) =>
      this.valorDeOrden(a, sort.active)
        .localeCompare(this.valorDeOrden(b, sort.active), 'es-AR', { sensitivity: 'base' }) * factor,
    );
  }

  private valorDeOrden(evento: EventoDeVidaVM, key: string): string {
    switch (key) {
      case 'nombre': return evento.nombre ?? '';
      case 'slug':   return evento.slug ?? '';
      default:       return '';
    }
  }

  private filtrosActivos(search: string): FiltroActivo[] {
    const termino = search.trim();
    return termino ? [{ clave: 'search', etiqueta: `Búsqueda: ${termino}` }] : [];
  }

  private estadoVacio(hayFiltros: boolean): EstadoVacio {
    // Con filtros activos el CTA siempre limpia (aunque el dataset esté vacío): "Nuevo…" solo sin filtros.
    if (hayFiltros) {
      return {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ningún evento de vida coincide con la búsqueda aplicada.',
        emptyActionLabel: 'Limpiar filtros',
      };
    }
    return {
      emptyTitle: 'Todavía no hay eventos de vida',
      emptyMessage: 'Creá el primero para agrupar los trámites por momento de la vida del ciudadano.',
      emptyActionLabel: 'Nuevo evento',
    };
  }
}
