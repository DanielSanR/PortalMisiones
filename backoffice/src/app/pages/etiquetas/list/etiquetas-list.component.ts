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
import { buscarEn } from '@core/utils/list-filter.utils';
import { FilterTabOption } from '../../../shared/components/filter-tabs';
import { CREAR_ETIQUETA_ACCESS } from '@core/constants/policy-overrides.constants';
import { EtiquetasFacade, EtiquetaVM } from '@features/etiquetas';

/** Textos del estado vacío: distinguen "todavía no hay nada" de "los filtros no matchean". */
interface EstadoVacio {
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
}

/** Filtro por alcance del `Tag` real: global (sin organismo) o local (con organismo). */
type AlcanceFiltro = 'todas' | 'globales' | 'locales';

const ALCANCE_LABELS: Record<Exclude<AlcanceFiltro, 'todas'>, string> = {
  globales: 'Globales',
  locales: 'Locales',
};

function filtrarPorAlcance(etiquetas: EtiquetaVM[], filtro: AlcanceFiltro): EtiquetaVM[] {
  if (filtro === 'globales') return etiquetas.filter((e) => !e.local);
  if (filtro === 'locales') return etiquetas.filter((e) => e.local);
  return etiquetas;
}

function alcanceTabs(etiquetas: EtiquetaVM[]): FilterTabOption[] {
  const locales = etiquetas.filter((e) => e.local).length;
  return [
    { value: 'todas', label: 'Todas', count: etiquetas.length },
    { value: 'globales', label: ALCANCE_LABELS.globales, count: etiquetas.length - locales },
    { value: 'locales', label: ALCANCE_LABELS.locales, count: locales },
  ];
}

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
  /** "Nueva etiqueta" (botón y CTA del vacío): solo quien puede elegir un alcance válido (BO-20). */
  readonly crearAccess = CREAR_ETIQUETA_ACCESS;

  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  /** Id de la etiqueta con un borrado en vuelo, para bloquear su fila mientras dura. */
  deletingId: string | null = null;

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  /** Filtro "Todas/Globales/Locales" (campo real `local`), client-side sobre el stream ya cargado. */
  readonly filtro$ = new BehaviorSubject<AlcanceFiltro>('todas');
  readonly sort$ = new BehaviorSubject<TableSortEvent | null>(null);

  private readonly search$ = this.searchCtrl.valueChanges.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    startWith(this.searchCtrl.value),
  );

  /** Los contadores de los chips se calculan sobre lo ya buscado, para que no mientan. */
  readonly filterTabs$ = combineLatest([this.etiquetas$, this.search$]).pipe(
    map(([etiquetas, search]) => alcanceTabs(this.buscar(etiquetas, search))),
  );

  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);

  readonly vista$ = combineLatest([
    this.etiquetas$, this.filtro$, this.search$, this.sort$, this.pageIndex$, this.pageSize$,
  ]).pipe(
    map(([etiquetas, filtro, search, sort, pageIndex, pageSize]): EtiquetasVista => {
      const filtradas = this.ordenar(filtrarPorAlcance(this.buscar(etiquetas, search), filtro), sort);
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
        ...this.estadoVacio(hayFiltros),
      };
    }),
  );

  columns: TableColumn<EtiquetaVM>[] = [
    { key: 'slug',          label: 'Etiqueta',  sortable: true },
    { key: 'organismo',     label: 'Organismo', sortable: true, hideOnMobile: true },
    { key: 'acciones',      label: 'Acciones',  width: '140px' },
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
    this.filtro$.next('todas');
  }

  /** Quita un solo filtro desde su chip en la barra "Filtros activos". */
  quitarFiltro(clave: string): void {
    if (clave === 'search') this.searchCtrl.setValue('');
    else this.filtro$.next('todas');
  }

  hayFiltrosActivos(): boolean {
    return this.filtro$.value !== 'todas' || this.searchCtrl.value.trim().length > 0;
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
      permission: 'UPDATE_TAG',
      run: () => this.onEdit(etiqueta),
    };
  }

  accionesDe(etiqueta: EtiquetaVM): RowAction[] {
    return [{
      label: 'Eliminar',
      icon: 'trash',
      permission: 'DELETE_TAG',
      danger: true,
      ariaLabel: `Eliminar etiqueta ${etiqueta.slug}`,
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
        message: `Se eliminará la etiqueta ${etiqueta.slug} y dejará de estar disponible para clasificar trámites. Esta acción no se puede deshacer.`,
        highlight: etiqueta.slug,
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

  private buscar(etiquetas: EtiquetaVM[], termino: string): EtiquetaVM[] {
    return buscarEn(etiquetas, termino, (e) => [e.slug, e.organismoNombre]);
  }

  private ordenar(etiquetas: EtiquetaVM[], sort: TableSortEvent | null): EtiquetaVM[] {
    if (!sort?.direction) return etiquetas;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...etiquetas].sort((a, b) => this.comparar(a, b, sort.active) * factor);
  }

  private comparar(a: EtiquetaVM, b: EtiquetaVM, key: string): number {
    return this.valorDeOrden(a, key)
      .localeCompare(this.valorDeOrden(b, key), 'es-AR', { sensitivity: 'base' });
  }

  private valorDeOrden(etiqueta: EtiquetaVM, key: string): string {
    switch (key) {
      case 'slug':      return etiqueta.slug ?? '';
      // Las globales (sin organismo) quedan juntas en un extremo en vez de mezclarse.
      case 'organismo': return etiqueta.organismoNombre ?? '';
      default:          return '';
    }
  }

  private filtrosActivos(search: string, filtro: AlcanceFiltro): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    const termino = search.trim();
    if (termino) activos.push({ clave: 'search', etiqueta: `Búsqueda: ${termino}` });
    if (filtro !== 'todas') {
      activos.push({ clave: 'alcance', etiqueta: `Alcance: ${ALCANCE_LABELS[filtro]}` });
    }
    return activos;
  }

  private estadoVacio(hayFiltros: boolean): EstadoVacio {
    // Con filtros activos el CTA siempre limpia (aunque el dataset esté vacío): "Nuevo…" solo sin filtros.
    if (hayFiltros) {
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
