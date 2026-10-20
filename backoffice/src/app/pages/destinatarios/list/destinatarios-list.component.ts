import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, ElementRef, inject } from '@angular/core';
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
import { UnavailableDirective } from '../../../shared/directives/unavailable.directive';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { buscarEn, todasOnlyTabs } from '@core/utils/list-filter.utils';
import { DestinatariosFacade, DestinatarioVM } from '@features/destinatarios';
import { enfocarTrasEliminar, indiceDeFilaActiva } from '@shared/utils/foco-lista';

/** Textos del estado vacío: distinguen "todavía no hay nada" de "los filtros no matchean". */
interface EstadoVacio {
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
}

/** ViewModel de la pantalla: filas ya buscadas/ordenadas + los textos que corresponden. */
interface DestinatariosVista extends EstadoVacio {
  /** Solo la página visible. */
  rows: DestinatarioVM[];
  /** Total tras buscar (lo que cuenta el toolbar y alimenta al paginador). */
  total: number;
  pageIndex: number;
  hayFiltros: boolean;
  filtrosActivos: FiltroActivo[];
}

@Component({
  selector: 'app-destinatarios-list',
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
    UnavailableDirective,
  ],
  templateUrl: './destinatarios-list.component.html',
  styleUrls: ['./destinatarios-list.component.scss'],
})
export class DestinatariosListComponent implements OnInit {
  private readonly facade = inject(DestinatariosFacade);
  readonly destinatarios$ = this.facade.destinatarios$;

  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  /** Id del destinatario con un borrado en vuelo, para bloquear su fila mientras dura. */
  deletingId: string | null = null;

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  readonly sort$ = new BehaviorSubject<TableSortEvent | null>(null);

  private readonly search$ = this.searchCtrl.valueChanges.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    startWith(this.searchCtrl.value),
  );

  /**
   * `DestinatarioVM` solo tiene id y nombre: no hay ningún campo real por el que filtrar,
   * así que la barra queda con el único chip "Todas" en vez de fabricar estados inexistentes.
   * El contador se calcula sobre lo ya buscado, para que no mienta.
   */
  readonly filterTabs$ = combineLatest([this.destinatarios$, this.search$]).pipe(
    map(([destinatarios, search]) => todasOnlyTabs(this.buscar(destinatarios, search).length)),
  );

  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);

  readonly vista$ = combineLatest([
    this.destinatarios$, this.search$, this.sort$, this.pageIndex$, this.pageSize$,
  ]).pipe(
    map(([destinatarios, search, sort, pageIndex, pageSize]): DestinatariosVista => {
      const filtradas = this.ordenar(this.buscar(destinatarios, search), sort);
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

  columns: TableColumn<DestinatarioVM>[] = [
    { key: 'nombre',   label: 'Nombre',   sortable: true },
    { key: 'acciones', label: 'Acciones', width: '140px' },
  ];

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

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
    this.facade.loadDestinatarios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        // Sin esto la lista quedaría mostrando el estado vacío como si no hubiera
        // destinatarios, indistinguible de una carga fallida.
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
    this.router.navigate(['/dashboard/destinatarios/nuevo']);
  }

  accionEditar(destinatario: DestinatarioVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_RECIPIENT',
      run: () => this.onEdit(destinatario),
    };
  }

  accionesDe(destinatario: DestinatarioVM): RowAction[] {
    return [{
      label: 'Eliminar',
      icon: 'trash',
      permission: 'DELETE_RECIPIENT',
      danger: true,
      ariaLabel: `Eliminar destinatario ${destinatario.nombre}`,
      run: () => this.onDelete(destinatario),
    }];
  }

  onEdit(destinatario: DestinatarioVM): void {
    this.router.navigate(['/dashboard/destinatarios/editar', destinatario.id]);
  }

  onDelete(destinatario: DestinatarioVM): void {
    // Foco tras borrar: la fila (y su botón) desaparece; se captura la posición antes de abrir el diálogo.
    const indice = indiceDeFilaActiva(this.host);
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '¿Eliminar el destinatario?',
        // Cuenta la consecuencia, no la restricción. Que no se pueda borrar un destinatario
        // en uso lo decide el backend y, si corresponde, vuelve como error.
        message: `Se eliminará ${destinatario.nombre} y dejará de estar disponible para clasificar trámites. Esta acción no se puede deshacer.`,
        highlight: destinatario.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando...',
        // El diálogo se queda abierto con el botón en spinner hasta que el backend
        // responde, en vez de cerrar optimistamente y dejar al usuario sin señal.
        confirmAction: () => {
          this.deletingId = destinatario.id;
          this.cdr.markForCheck();
          return this.facade.delete(destinatario.id).pipe(
            finalize(() => { this.deletingId = null; this.cdr.markForCheck(); }),
          );
        },
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        enfocarTrasEliminar(this.host, indice, this.destroyRef);
        this.snackBar.open('Destinatario eliminado', 'OK', {
          duration: 3000,
          // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
          panelClass: 'snackbar-success',
        });
      });
  }

  private buscar(destinatarios: DestinatarioVM[], termino: string): DestinatarioVM[] {
    return buscarEn(destinatarios, termino, (d) => [d.nombre]);
  }

  private ordenar(destinatarios: DestinatarioVM[], sort: TableSortEvent | null): DestinatarioVM[] {
    if (!sort?.direction) return destinatarios;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...destinatarios].sort((a, b) =>
      this.valorDeOrden(a, sort.active)
        .localeCompare(this.valorDeOrden(b, sort.active), 'es-AR', { sensitivity: 'base' }) * factor,
    );
  }

  private valorDeOrden(destinatario: DestinatarioVM, key: string): string {
    switch (key) {
      case 'nombre': return destinatario.nombre ?? '';
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
        emptyMessage: 'Ningún destinatario coincide con la búsqueda aplicada.',
        emptyActionLabel: 'Limpiar filtros',
      };
    }
    return {
      emptyTitle: 'Todavía no hay destinatarios',
      emptyMessage: 'Creá el primero para poder indicar a quién está dirigido cada trámite.',
      emptyActionLabel: 'Nuevo destinatario',
    };
  }
}
