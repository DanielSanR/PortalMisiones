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
import { ModalidadesFacade, ModalidadVM } from '@features/modalidades';

/** Textos del estado vacío: distinguen "todavía no hay nada" de "la búsqueda no matchea". */
interface EstadoVacio {
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
}

/** ViewModel de la pantalla: filas ya buscadas/ordenadas/paginadas + los textos que corresponden. */
interface ModalidadesVista extends EstadoVacio {
  /** Solo la página visible. */
  rows: ModalidadVM[];
  /** Total tras buscar (lo que cuenta el toolbar y alimenta al paginador). */
  total: number;
  pageIndex: number;
  hayFiltros: boolean;
  filtrosActivos: FiltroActivo[];
}

@Component({
  selector: 'app-modalidades-list',
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
  templateUrl: './modalidades-list.component.html',
  styleUrls: ['./modalidades-list.component.scss'],
})
export class ModalidadesListComponent implements OnInit {
  private readonly facade = inject(ModalidadesFacade);
  readonly modalidades$ = this.facade.modalidades$;

  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  /** Id de la modalidad con un borrado en vuelo, para bloquear su fila mientras dura. */
  deletingId: string | null = null;

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  readonly sort$ = new BehaviorSubject<TableSortEvent | null>(null);

  private readonly search$ = this.searchCtrl.valueChanges.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    startWith(this.searchCtrl.value),
  );

  /**
   * Chip único "Todas": el `activo` del VM es un soft-delete que el backend nunca devuelve
   * en false, así que un filtro Activas/Inactivas contaría siempre cero y mentiría.
   * El contador se calcula sobre lo ya buscado, igual que en el resto de las listas.
   */
  readonly filterTabs$ = combineLatest([this.modalidades$, this.search$]).pipe(
    map(([modalidades, search]) => todasOnlyTabs(this.buscar(modalidades, search).length)),
  );

  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);

  readonly vista$ = combineLatest([
    this.modalidades$, this.search$, this.sort$, this.pageIndex$, this.pageSize$,
  ]).pipe(
    map(([modalidades, search, sort, pageIndex, pageSize]): ModalidadesVista => {
      const filtradas = this.ordenar(this.buscar(modalidades, search), sort);
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
        ...this.estadoVacio(modalidades.length, hayFiltros),
      };
    }),
  );

  columns: TableColumn<ModalidadVM>[] = [
    { key: 'nombre',   label: 'Nombre',   sortable: true },
    { key: 'acciones', label: 'Acciones', width: '140px' },
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
    this.facade.loadModalidades()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        // Sin esto la lista quedaría mostrando el estado vacío como si no hubiera
        // modalidades, indistinguible de una carga fallida.
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
    this.router.navigate(['/dashboard/modalidades/nuevo']);
  }

  accionEditar(modalidad: ModalidadVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_MODALITY',
      run: () => this.onEdit(modalidad),
    };
  }

  accionesDe(modalidad: ModalidadVM): RowAction[] {
    return [{
      label: 'Eliminar',
      icon: 'trash',
      permission: 'DELETE_MODALITY',
      danger: true,
      ariaLabel: `Eliminar modalidad ${modalidad.nombre}`,
      run: () => this.onDelete(modalidad),
    }];
  }

  onEdit(modalidad: ModalidadVM): void {
    this.router.navigate(['/dashboard/modalidades/editar', modalidad.id]);
  }

  onDelete(modalidad: ModalidadVM): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '¿Eliminar la modalidad?',
        // Cuenta la consecuencia, no la restricción: si el backend rechaza borrar una
        // modalidad en uso, eso vuelve como error del propio pedido.
        message: `Se eliminará ${modalidad.nombre} y dejará de estar disponible para clasificar trámites. Esta acción no se puede deshacer.`,
        highlight: modalidad.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando...',
        // El diálogo se queda abierto con el botón en spinner hasta que el backend
        // responde, en vez de cerrar optimistamente y dejar al usuario sin señal.
        confirmAction: () => {
          this.deletingId = modalidad.id;
          this.cdr.markForCheck();
          return this.facade.delete(modalidad.id).pipe(
            finalize(() => { this.deletingId = null; this.cdr.markForCheck(); }),
          );
        },
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open('Modalidad eliminada', 'OK', {
        duration: 3000,
        // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
        panelClass: 'snackbar-success',
      }));
  }

  private buscar(modalidades: ModalidadVM[], termino: string): ModalidadVM[] {
    return buscarEn(modalidades, termino, (m) => [m.nombre]);
  }

  private ordenar(modalidades: ModalidadVM[], sort: TableSortEvent | null): ModalidadVM[] {
    if (!sort?.direction) return modalidades;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...modalidades].sort((a, b) =>
      this.valorDeOrden(a, sort.active)
        .localeCompare(this.valorDeOrden(b, sort.active), 'es-AR', { sensitivity: 'base' }) * factor,
    );
  }

  private valorDeOrden(modalidad: ModalidadVM, key: string): string {
    switch (key) {
      case 'nombre': return modalidad.nombre ?? '';
      default:       return '';
    }
  }

  private filtrosActivos(search: string): FiltroActivo[] {
    const termino = search.trim();
    return termino ? [{ clave: 'search', etiqueta: `Búsqueda: ${termino}` }] : [];
  }

  private estadoVacio(total: number, hayFiltros: boolean): EstadoVacio {
    if (total > 0 && hayFiltros) {
      return {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ninguna modalidad coincide con la búsqueda.',
        emptyActionLabel: 'Limpiar búsqueda',
      };
    }
    return {
      emptyTitle: 'Todavía no hay modalidades',
      emptyMessage: 'Creá la primera para indicar de qué forma se puede realizar cada trámite.',
      emptyActionLabel: 'Nueva modalidad',
    };
  }
}
