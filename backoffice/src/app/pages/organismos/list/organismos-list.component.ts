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
import { OrganismosFacade, OrganismoVM } from '@features/organismos';
import { PARAM_ORIGEN_EDICION } from '../organismo-origen';

/** Textos del estado vacío: distinguen "todavía no hay nada" de "los filtros no matchean". */
interface EstadoVacio {
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
}

/** ViewModel de la pantalla: filas ya filtradas/ordenadas + los textos que corresponden. */
interface OrganismosVista extends EstadoVacio {
  /** Solo la página visible. */
  rows: OrganismoVM[];
  /** Total tras filtrar (lo que cuenta el toolbar y alimenta al paginador). */
  total: number;
  pageIndex: number;
  hayFiltros: boolean;
  filtrosActivos: FiltroActivo[];
}

/** Paleta de tintes de los avatares de la tabla (Kitchen Sink §05). */
const TINTES = ['blue', 'warm', 'green', 'grey'] as const;

@Component({
  selector: 'app-organismos-list',
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

  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);

  readonly vista$ = combineLatest([
    this.organismos$, this.filtro$, this.search$, this.sort$, this.pageIndex$, this.pageSize$,
  ]).pipe(
    map(([organismos, filtro, search, sort, pageIndex, pageSize]): OrganismosVista => {
      const filtradas = this.ordenar(filterByActivo(this.buscar(organismos, search), filtro), sort);
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
        ...this.estadoVacio(organismos.length, hayFiltros),
      };
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

  /** Quita un solo filtro desde su chip en la barra "Filtros activos". */
  quitarFiltro(clave: string): void {
    if (clave === 'search') this.searchCtrl.setValue('');
    else this.filtro$.next('todos');
  }

  hayFiltrosActivos(): boolean {
    return this.filtro$.value !== 'todos' || this.searchCtrl.value.trim().length > 0;
  }

  // NOTA: el diseño dibuja un chip "/" también en este buscador, pero esa tecla ya está
  // tomada por el buscador global del shell (admin-layout.component.ts:108) y una misma
  // tecla no puede enfocar dos inputs. Se omite acá para no mostrar un atajo que no
  // hace lo que promete; si se quiere uno propio hay que elegir otra tecla.

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

  /**
   * Iniciales del avatar: las dos primeras letras de la SIGLA.
   *
   * Es la regla del diseño, no las iniciales del nombre. "Secretaría de Estado de
   * Agricultura Familiar" (SAF) da "SA", que por nombre daría "SE". Cuando no hay
   * sigla se cae a las iniciales del nombre, salteando conectores para que
   * "Instituto de Previsión Social" no dé "ID".
   */
  iniciales(organismo: OrganismoVM): string {
    const letrasSigla = (organismo.acronym ?? '').replace(/[^\p{L}]/gu, '');
    if (letrasSigla.length >= 2) return letrasSigla.slice(0, 2).toLocaleUpperCase('es-AR');

    const conectores = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para']);
    const palabras = (organismo.nombre ?? '')
      .split(/\s+/)
      .filter((palabra) => /\p{L}/u.test(palabra) && !conectores.has(palabra.toLocaleLowerCase('es-AR')));

    if (palabras.length === 0) return '—';
    // Nombre de una sola palabra ("Vialidad"): dos letras se leen mejor que una.
    const letras = palabras.length === 1
      ? palabras[0].slice(0, 2)
      : palabras.slice(0, 2).map((palabra) => palabra[0]).join('');
    return letras.toLocaleUpperCase('es-AR');
  }

  /**
   * Tinte del avatar. Se deriva del id para que un mismo organismo conserve su color
   * entre recargas y ordenamientos, en vez de depender de la posición en la lista.
   */
  tinte(id: string): string {
    let acumulado = 0;
    for (const caracter of id ?? '') acumulado = (acumulado + caracter.charCodeAt(0)) % 997;
    return TINTES[acumulado % TINTES.length];
  }

  accionEditar(organismo: OrganismoVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_ORGANISM',
      run: () => this.onEdit(organismo),
    };
  }

  accionesDe(organismo: OrganismoVM): RowAction[] {
    return [
      {
        label: 'Ver detalle',
        icon: 'eye',
        permission: 'READ_ORGANISM',
        ariaLabel: `Ver detalle de ${organismo.nombre}`,
        run: () => this.onVerDetalle(organismo),
      },
      {
        label: 'Eliminar',
        icon: 'trash',
        permission: 'DELETE_ORGANISM',
        danger: true,
        ariaLabel: `Eliminar organismo ${organismo.nombre}`,
        run: () => this.onDelete(organismo),
      },
    ];
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/organismos/nuevo']);
  }

  onVerDetalle(organismo: OrganismoVM): void {
    this.router.navigate(['/dashboard/organismos/detalle', organismo.id]);
  }

  onEdit(organismo: OrganismoVM): void {
    this.router.navigate(['/dashboard/organismos/editar', organismo.id], {
      queryParams: { [PARAM_ORIGEN_EDICION]: 'lista' },
    });
  }

  onDelete(organismo: OrganismoVM): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '¿Eliminar el organismo?',
        // El diseño pide contar la consecuencia, no la restricción: qué pasa si sigo.
        // La regla de "no se puede si tiene hijos activos" la aplica el backend y, si
        // corresponde, vuelve como error; acá solo estorbaba.
        message: `Se eliminará ${organismo.nombre} y dejará de estar disponible para asociar trámites y usuarios. Esta acción no se puede deshacer.`,
        highlight: organismo.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
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
      .subscribe(() => this.snackBar.open('Organismo eliminado', 'OK', {
        duration: 3000,
        // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
        panelClass: 'snackbar-success',
      }));
  }

  private buscar(organismos: OrganismoVM[], termino: string): OrganismoVM[] {
    return buscarEn(organismos, termino, (o) => [o.nombre, o.acronym, o.tipoNombre, o.parentNombre]);
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
