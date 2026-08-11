import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, filter, finalize, map, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SharedTableComponent, TableCellDirective, TableColumn, TableSortEvent } from '../../../shared/components/table';
import { FilterTabsComponent } from '../../../shared/components/filter-tabs';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { ActivoFiltro, activoFilterTabs, filterByActivo } from '@core/utils/list-filter.utils';
import { OrganismosFacade, OrganismoVM } from '@features/organismos';

/** Textos del estado vacío: distinguen "todavía no hay nada" de "los filtros no matchean". */
interface EstadoVacio {
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
}

/** ViewModel de la pantalla: filas ya filtradas/ordenadas + los textos que corresponden. */
interface OrganismosVista extends EstadoVacio {
  rows: OrganismoVM[];
  hayFiltros: boolean;
}

@Component({
  selector: 'app-organismos-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    FilterTabsComponent,
    HasPermissionDirective,
    PageActionsDirective,
  ],
  templateUrl: './organismos-list.component.html',
  styleUrls: ['./organismos-list.component.scss'],
})
export class OrganismosListComponent implements OnInit {
  private readonly facade = inject(OrganismosFacade);
  readonly organismos$ = this.facade.organismos$;

  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  /** Id del organismo con un borrado en vuelo, para bloquear su fila mientras dura. */
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
  readonly filterTabs$ = combineLatest([this.organismos$, this.search$]).pipe(
    map(([organismos, search]) => activoFilterTabs(this.buscar(organismos, search))),
  );

  readonly vista$ = combineLatest([this.organismos$, this.filtro$, this.search$, this.sort$]).pipe(
    map(([organismos, filtro, search, sort]): OrganismosVista => {
      const rows = this.ordenar(filterByActivo(this.buscar(organismos, search), filtro), sort);
      const hayFiltros = filtro !== 'todos' || search.trim().length > 0;
      return { rows, hayFiltros, ...this.estadoVacio(organismos.length, hayFiltros) };
    }),
  );

  columns: TableColumn<OrganismoVM>[] = [
    { key: 'nombre',       label: 'Nombre',     sortable: true },
    { key: 'parentNombre', label: 'Depende de', sortable: true, hideOnMobile: true },
    { key: 'tipoNombre',   label: 'Tipo',       sortable: true, hideOnMobile: true },
    { key: 'activo',       label: 'Activo',     sortable: true, width: '110px' },
    { key: 'acciones',     label: 'Acciones',   width: '140px' },
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
    this.facade.loadOrganismos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        // Sin esto la lista quedaría mostrando el estado vacío como si no hubiera
        // organismos, indistinguible de una carga fallida.
        error: () => { this.loading = false; this.error = true; this.cdr.markForCheck(); },
      });
  }

  limpiarFiltros(): void {
    this.searchCtrl.setValue('');
    this.filtro$.next('todos');
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

  onCreate(): void {
    this.router.navigate(['/dashboard/organismos/nuevo']);
  }

  onEdit(organismo: OrganismoVM): void {
    this.router.navigate(['/dashboard/organismos/editar', organismo.id]);
  }

  onDelete(organismo: OrganismoVM): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar organismo',
        message: `¿Está seguro de eliminar "${organismo.nombre}"? Esta acción es permanente y no se puede deshacer. No se puede eliminar si tiene organismos hijos activos.`,
        confirmText: 'Eliminar',
        busyText: 'Eliminando...',
        // El diálogo se queda abierto con el botón en spinner hasta que el backend responde,
        // en vez de cerrar optimistamente y dejar al usuario sin señal. La fila queda
        // bloqueada en paralelo para que la lista de atrás no invite a re-clickear.
        confirmAction: () => {
          this.deletingId = organismo.id;
          this.cdr.markForCheck();
          return this.facade.delete(organismo.id).pipe(
            finalize(() => { this.deletingId = null; this.cdr.markForCheck(); }),
          );
        },
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open('Organismo eliminado', 'OK', { duration: 3000 }));
  }

  private buscar(organismos: OrganismoVM[], termino: string): OrganismoVM[] {
    const q = termino.trim().toLocaleLowerCase('es-AR');
    if (!q) return organismos;
    return organismos.filter((o) =>
      [o.nombre, o.acronym, o.tipoNombre, o.parentNombre]
        .some((campo) => (campo ?? '').toLocaleLowerCase('es-AR').includes(q)),
    );
  }

  private ordenar(organismos: OrganismoVM[], sort: TableSortEvent | null): OrganismoVM[] {
    if (!sort?.direction) return organismos;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...organismos].sort((a, b) =>
      this.valorDeOrden(a, sort.active)
        .localeCompare(this.valorDeOrden(b, sort.active), 'es-AR', { sensitivity: 'base' }) * factor,
    );
  }

  private valorDeOrden(organismo: OrganismoVM, key: string): string {
    switch (key) {
      case 'nombre':       return organismo.nombre ?? '';
      case 'parentNombre': return organismo.parentNombre ?? '';
      case 'tipoNombre':   return organismo.tipoNombre ?? '';
      case 'activo':       return organismo.activo ? 'Activo' : 'Inactivo';
      default:             return '';
    }
  }

  private estadoVacio(total: number, hayFiltros: boolean): EstadoVacio {
    if (total > 0 && hayFiltros) {
      return {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ningún organismo coincide con la búsqueda o el filtro aplicado.',
        emptyActionLabel: 'Limpiar filtros',
      };
    }
    return {
      emptyTitle: 'Todavía no hay organismos',
      emptyMessage: 'Creá el primero para poder asociarle trámites y usuarios.',
      emptyActionLabel: 'Nuevo organismo',
    };
  }
}
