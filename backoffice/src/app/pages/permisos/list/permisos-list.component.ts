import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, filter, finalize, map, shareReplay, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SharedTableComponent, TableCellDirective, TableColumn, TablePageEvent, TableSortEvent } from '../../../shared/components/table';
import { FilterTabsComponent, FilterTabOption } from '../../../shared/components/filter-tabs';
import { RowAction, RowActionsComponent } from '../../../shared/components/row-actions';
import { ListSearchComponent } from '../../../shared/components/list-search';
import { ActiveFiltersComponent, FiltroActivo } from '../../../shared/components/active-filters';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { buscarEn } from '@core/utils/list-filter.utils';
import { buildPermisoGroups, PERMISO_ACTION_LABELS } from '@core/utils/permiso-groups.util';
import { PermisosFacade, PermisoVM } from '@features/permisos';

/** Valor "sin filtrar" de los dos filtros con dato real (acción y recurso). */
const TODAS = 'todas';

/**
 * Fila de la tabla: el permiso más lo que se deduce de su código `ACCION_RECURSO`
 * (ver `permiso-groups.util.ts`). Se precalcula una vez por catálogo porque tanto el
 * filtrado como el orden y la celda lo necesitan en cada emisión.
 */
interface PermisoFilaVM extends PermisoVM {
  recursoKey: string;
  recursoLabel: string;
  accionKey: string;
  accionLabel: string;
}

/** Opción del select "Recurso" — derivada del catálogo, no de una lista fija. */
interface OpcionRecurso {
  key: string;
  label: string;
}

/** Textos del estado vacío: distinguen "todavía no hay nada" de "los filtros no matchean". */
interface EstadoVacio {
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
}

/** ViewModel de la pantalla: filas ya buscadas/filtradas/ordenadas + los textos que corresponden. */
interface PermisosVista extends EstadoVacio {
  /** Solo la página visible. */
  rows: PermisoFilaVM[];
  /** Total tras filtrar (lo que cuenta el toolbar y alimenta al paginador). */
  total: number;
  pageIndex: number;
  hayFiltros: boolean;
  filtrosActivos: FiltroActivo[];
  /** Chips de acción, con los contadores calculados sobre lo ya buscado y filtrado por recurso. */
  tabs: FilterTabOption[];
  /** Opciones del select: salen del catálogo completo, así no se achican al filtrar. */
  recursos: OpcionRecurso[];
}

@Component({
  selector: 'app-permisos-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    FilterTabsComponent,
    RowActionsComponent,
    ListSearchComponent,
    ActiveFiltersComponent,
    PageActionsDirective,
  ],
  templateUrl: './permisos-list.component.html',
  styleUrl: './permisos-list.component.scss',
})
export class PermisosListComponent implements OnInit {
  private readonly facade = inject(PermisosFacade);
  readonly permisos$ = this.facade.permisos$;

  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  /** Id del permiso con un borrado en vuelo, para bloquear su fila mientras dura. */
  deletingId: string | null = null;

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  /** Filtro por recurso (`ACCION_RECURSO`); '' = todos. Es select y no chips: hay ~14 recursos. */
  readonly recursoCtrl = new FormControl('', { nonNullable: true });
  /** Filtro por acción (CREATE/READ/...), en la fila de chips. */
  readonly filtro$ = new BehaviorSubject<string>(TODAS);
  readonly sort$ = new BehaviorSubject<TableSortEvent | null>(null);

  private readonly search$ = this.searchCtrl.valueChanges.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    startWith(this.searchCtrl.value),
  );

  private readonly recurso$ = this.recursoCtrl.valueChanges.pipe(
    distinctUntilChanged(),
    startWith(this.recursoCtrl.value),
  );

  /**
   * Catálogo ya indexado por recurso/acción. Deriva solo de `permisos$`, así que se
   * recalcula al recargar y no en cada tecleo del buscador.
   */
  private readonly filas$ = this.permisos$.pipe(
    map((permisos) => this.indexar(permisos)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);

  readonly vista$ = combineLatest([
    this.filas$, this.search$, this.recurso$, this.filtro$, this.sort$, this.pageIndex$, this.pageSize$,
  ]).pipe(
    map(([filas, search, recurso, accion, sort, pageIndex, pageSize]): PermisosVista => {
      const porRecurso = this.buscar(filas, search)
        .filter((fila) => !recurso || fila.recursoKey === recurso);
      const filtradas = this.ordenar(
        porRecurso.filter((fila) => accion === TODAS || fila.accionKey === accion),
        sort,
      );
      // Al filtrar, la página actual puede quedar fuera de rango: se acota en vez de
      // mostrar una tabla vacía con resultados que sí existen.
      const ultimaPagina = Math.max(0, Math.ceil(filtradas.length / pageSize) - 1);
      const pagina = Math.min(pageIndex, ultimaPagina);
      const desde = pagina * pageSize;

      const filtrosActivos = this.filtrosActivos(filas, search, recurso, accion);
      const hayFiltros = filtrosActivos.length > 0;
      return {
        rows: filtradas.slice(desde, desde + pageSize),
        total: filtradas.length,
        pageIndex: pagina,
        hayFiltros,
        filtrosActivos,
        tabs: this.tabsDeAccion(porRecurso),
        recursos: this.recursosDe(filas),
        ...this.estadoVacio(filas.length, hayFiltros),
      };
    }),
  );

  columns: TableColumn<PermisoFilaVM>[] = [
    { key: 'codigo',      label: 'Código',      sortable: true, width: '32%' },
    { key: 'recurso',     label: 'Recurso',     sortable: true, width: '18%', hideOnMobile: true },
    { key: 'descripcion', label: 'Descripción', sortable: true, hideOnMobile: true },
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
    this.facade.loadPermisos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        // Sin esto la lista quedaría mostrando el estado vacío como si no hubiera
        // permisos, indistinguible de una carga fallida.
        error: () => { this.loading = false; this.error = true; this.cdr.markForCheck(); },
      });
  }

  limpiarFiltros(): void {
    this.searchCtrl.setValue('');
    this.recursoCtrl.setValue('');
    this.filtro$.next(TODAS);
  }

  /** Quita un solo filtro desde su chip en la barra "Filtros activos". */
  quitarFiltro(clave: string): void {
    if (clave === 'search') this.searchCtrl.setValue('');
    else if (clave === 'recurso') this.recursoCtrl.setValue('');
    else this.filtro$.next(TODAS);
  }

  hayFiltrosActivos(): boolean {
    return this.searchCtrl.value.trim().length > 0
      || this.recursoCtrl.value !== ''
      || this.filtro$.value !== TODAS;
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
    this.router.navigate(['/dashboard/permisos/nuevo']);
  }

  /**
   * Sin `permission`: `/api/permission` se autoriza por ROL (hasAnyRole SUPERADMIN/ADMIN_BACKOFFICE,
   * BACKEND_API_SPEC.md §4.5) y no por permiso atómico, igual que Roles. La ruta ya exige esos roles
   * (`requireRoles` en `pages.module.ts`), así que quien ve la pantalla puede operar sus filas;
   * pedir además un permiso atómico escondería las acciones a todo el mundo, porque no existe.
   */
  accionEditar(permiso: PermisoFilaVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      run: () => this.onEdit(permiso),
    };
  }

  accionesDe(permiso: PermisoFilaVM): RowAction[] {
    return [{
      label: 'Eliminar',
      icon: 'trash',
      danger: true,
      ariaLabel: `Eliminar permiso ${permiso.codigo}`,
      run: () => this.onDelete(permiso),
    }];
  }

  onEdit(permiso: PermisoFilaVM): void {
    this.router.navigate(['/dashboard/permisos/editar', permiso.id]);
  }

  onDelete(permiso: PermisoFilaVM): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '¿Eliminar el permiso?',
        // Cuenta la consecuencia real: el permiso es un ítem del catálogo que los roles
        // referencian, así que borrarlo cambia lo que esos roles habilitan.
        message: `Se eliminará ${permiso.codigo} del catálogo y los roles que lo tengan asignado dejarán de otorgarlo. Esta acción no se puede deshacer.`,
        highlight: permiso.codigo,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando...',
        // El diálogo se queda abierto con el botón en spinner hasta que el backend
        // responde, en vez de cerrar optimistamente y dejar al usuario sin señal.
        confirmAction: () => {
          this.deletingId = permiso.id;
          this.cdr.markForCheck();
          return this.facade.delete(permiso.id).pipe(
            finalize(() => { this.deletingId = null; this.cdr.markForCheck(); }),
          );
        },
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open('Permiso eliminado', 'OK', {
        duration: 3000,
        // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
        panelClass: 'snackbar-success',
      }));
  }

  /**
   * Deduce recurso y acción de cada código reusando `buildPermisoGroups`, que es el único
   * punto de verdad de esa agrupación (lo comparte con Roles). Se lo llama con el set de
   * otorgados vacío porque acá no interesa quién tiene el permiso, sino a qué recurso pertenece.
   */
  private indexar(permisos: PermisoVM[]): PermisoFilaVM[] {
    const porId = new Map<string, OpcionRecurso>();
    for (const grupo of buildPermisoGroups(permisos, new Set<string>())) {
      for (const item of grupo.items) porId.set(item.id, { key: grupo.key, label: grupo.label });
    }

    return permisos.map((permiso): PermisoFilaVM => {
      const recurso = porId.get(permiso.id);
      const accionKey = permiso.codigo.split('_')[0];
      return {
        ...permiso,
        recursoKey: recurso?.key ?? '',
        recursoLabel: recurso?.label ?? '—',
        accionKey,
        accionLabel: PERMISO_ACTION_LABELS[accionKey] ?? accionKey,
      };
    });
  }

  /**
   * Busca por código y descripción, y también por los rótulos de recurso y acción: los
   * códigos están en inglés (`DELETE_PROCEDURE`) y la pantalla se lee en español, así que
   * sin esto buscar "trámites" o "eliminar" no encontraba nada.
   */
  private buscar(filas: PermisoFilaVM[], termino: string): PermisoFilaVM[] {
    return buscarEn(filas, termino, (p) => [p.codigo, p.descripcion, p.recursoLabel, p.accionLabel]);
  }

  private ordenar(filas: PermisoFilaVM[], sort: TableSortEvent | null): PermisoFilaVM[] {
    if (!sort?.direction) return filas;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...filas].sort((a, b) =>
      this.valorDeOrden(a, sort.active)
        .localeCompare(this.valorDeOrden(b, sort.active), 'es-AR', { sensitivity: 'base' }) * factor,
    );
  }

  private valorDeOrden(fila: PermisoFilaVM, key: string): string {
    switch (key) {
      case 'codigo':      return fila.codigo ?? '';
      case 'recurso':     return fila.recursoLabel ?? '';
      case 'descripcion': return fila.descripcion ?? '';
      default:            return '';
    }
  }

  /** Recursos presentes en el catálogo, ya ordenados por `buildPermisoGroups`. */
  private recursosDe(filas: PermisoFilaVM[]): OpcionRecurso[] {
    const porKey = new Map<string, OpcionRecurso>();
    for (const fila of filas) {
      if (!porKey.has(fila.recursoKey)) porKey.set(fila.recursoKey, { key: fila.recursoKey, label: fila.recursoLabel });
    }
    return [...porKey.values()].sort((a, b) => a.label.localeCompare(b.label, 'es-AR'));
  }

  /**
   * Chips de acción. Solo aparecen las acciones que existen en el catálogo (no se inventan
   * chips vacíos) y en el orden del ciclo de vida de `PERMISO_ACTION_LABELS`, no alfabético.
   */
  private tabsDeAccion(filas: PermisoFilaVM[]): FilterTabOption[] {
    const conteo = new Map<string, number>();
    const etiquetas = new Map<string, string>();
    for (const fila of filas) {
      conteo.set(fila.accionKey, (conteo.get(fila.accionKey) ?? 0) + 1);
      etiquetas.set(fila.accionKey, fila.accionLabel);
    }

    const orden = Object.keys(PERMISO_ACTION_LABELS);
    const posicion = (clave: string): number => {
      const at = orden.indexOf(clave);
      return at === -1 ? orden.length : at;
    };

    const claves = [...conteo.keys()].sort((a, b) =>
      posicion(a) - posicion(b) || a.localeCompare(b, 'es-AR'));

    return [
      { value: TODAS, label: 'Todas', count: filas.length },
      ...claves.map((clave): FilterTabOption => ({
        value: clave,
        label: etiquetas.get(clave) ?? clave,
        count: conteo.get(clave) ?? 0,
      })),
    ];
  }

  private filtrosActivos(filas: PermisoFilaVM[], search: string, recurso: string, accion: string): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    const termino = search.trim();
    if (termino) activos.push({ clave: 'search', etiqueta: `Búsqueda: ${termino}` });
    if (recurso) {
      const label = filas.find((fila) => fila.recursoKey === recurso)?.recursoLabel ?? recurso;
      activos.push({ clave: 'recurso', etiqueta: `Recurso: ${label}` });
    }
    if (accion !== TODAS) {
      const label = filas.find((fila) => fila.accionKey === accion)?.accionLabel
        ?? PERMISO_ACTION_LABELS[accion] ?? accion;
      activos.push({ clave: 'accion', etiqueta: `Acción: ${label}` });
    }
    return activos;
  }

  private estadoVacio(total: number, hayFiltros: boolean): EstadoVacio {
    if (total > 0 && hayFiltros) {
      return {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ningún permiso coincide con la búsqueda o los filtros aplicados.',
        emptyActionLabel: 'Limpiar filtros',
      };
    }
    return {
      emptyTitle: 'Todavía no hay permisos',
      emptyMessage: 'El catálogo de permisos define qué puede hacer cada rol. Creá el primero para empezar a armarlos.',
      emptyActionLabel: 'Nuevo permiso',
    };
  }
}
