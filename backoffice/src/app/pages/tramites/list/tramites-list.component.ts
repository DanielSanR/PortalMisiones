import { Component, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  BehaviorSubject, Observable, catchError, combineLatest, debounceTime,
  distinctUntilChanged, filter, finalize, map, of, shareReplay, startWith, switchMap, tap,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SharedTableComponent, TableCellDirective, TableColumn, TablePageEvent, TableSortEvent } from '../../../shared/components/table';
import { EstadoBadgeComponent } from '../../../shared/components/estado-badge/estado-badge.component';
import { FilterTabsComponent, FilterTabOption } from '../../../shared/components/filter-tabs';
import { RowAction, RowActionsComponent } from '../../../shared/components/row-actions';
import { ListSearchComponent } from '../../../shared/components/list-search';
import { ActiveFiltersComponent, FiltroActivo } from '../../../shared/components/active-filters';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { TramitesFacade, TramiteEstado, TramiteListQuery, TramiteVM, RefVM } from '@features/tramites';

/** Textos del estado vacío: distinguen "todavía no hay nada" de "los filtros no matchean". */
interface EstadoVacio {
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
}

/**
 * ViewModel de la pantalla. `cargando` y `error` viajan dentro del stream en vez de ser
 * campos mutados con `tap`: así el template lee un único objeto coherente y no hay
 * escritura de estado durante la detección de cambios.
 */
interface TramitesVista extends EstadoVacio {
  cargando: boolean;
  error: boolean;
  rows: TramiteVM[];
  total: number;
  tabs: FilterTabOption[];
  pageIndex: number;
  hayFiltros: boolean;
  filtrosActivos: FiltroActivo[];
}

const ESTADOS: { value: TramiteEstado; label: string }[] = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'revision', label: 'En revisión' },
  { value: 'publicado', label: 'Publicado' },
  { value: 'despublicado', label: 'Despublicado' },
];

@Component({
  selector: 'app-tramites-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    DatePipe,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    EstadoBadgeComponent,
    FilterTabsComponent,
    RowActionsComponent,
    ListSearchComponent,
    ActiveFiltersComponent,
    HasPermissionDirective,
    PageActionsDirective,
  ],
  templateUrl: './tramites-list.component.html',
  styleUrls: ['./tramites-list.component.scss'],
})
export class TramitesListComponent {
  private readonly facade = inject(TramitesFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly estados = ESTADOS;
  /** Id del trámite con una operación en vuelo, para bloquear su fila mientras dura. */
  trabajandoId: string | null = null;

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  readonly organismoCtrl = new FormControl('', { nonNullable: true });
  readonly estadoCtrl = new FormControl<TramiteEstado | ''>('', { nonNullable: true });
  readonly localidadCtrl = new FormControl<number | ''>('', { nonNullable: true });

  readonly sort$ = new BehaviorSubject<TableSortEvent | null>(null);
  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);
  /** Se emite tras cada acción de workflow o borrado para volver a pedir la página. */
  private readonly recargar$ = new BehaviorSubject<void>(undefined);

  /** Catálogos de los selects de filtro. Si fallan, los selects quedan vacíos pero la lista funciona. */
  readonly catalogos$ = this.facade.getCatalogos().pipe(
    map((c) => ({ organismos: c.organismos, localidades: c.localidades })),
    catchError(() => of({ organismos: [] as RefVM[], localidades: [] as RefVM[] })),
    tap(({ organismos, localidades }) => this.recordarNombres(organismos, localidades)),
    startWith({ organismos: [] as RefVM[], localidades: [] as RefVM[] }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  private readonly filtros$ = combineLatest([
    this.searchCtrl.valueChanges.pipe(startWith(this.searchCtrl.value), debounceTime(250), distinctUntilChanged()),
    this.organismoCtrl.valueChanges.pipe(startWith(this.organismoCtrl.value)),
    this.estadoCtrl.valueChanges.pipe(startWith(this.estadoCtrl.value)),
    this.localidadCtrl.valueChanges.pipe(startWith(this.localidadCtrl.value)),
  ]);

  readonly vista$: Observable<TramitesVista> = combineLatest([
    this.filtros$, this.sort$, this.pageIndex$, this.pageSize$, this.recargar$,
  ]).pipe(
    map(([[search, organismoId, estado, localidadId], sort, pageIndex, pageSize]): TramiteListQuery => ({
      search, organismoId, estado, localidadId,
      sortBy: sort?.active ?? '',
      sortDir: sort?.direction ?? '',
      page: pageIndex,
      pageSize,
    })),
    switchMap((query) =>
      combineLatest([this.facade.list(query), this.facade.conteos(query)]).pipe(
        map(([pagina, conteos]) => this.aVista(query, pagina.rows, pagina.total, [
          { value: 'todos', label: 'Todos', count: conteos.todos },
          { value: 'publicado', label: 'Publicados', count: conteos.publicado },
          { value: 'revision', label: 'Requieren revisión', count: conteos.revision, alert: true },
        ])),
        // Sin esto la tabla caía al estado vacío y decía "no se encontraron trámites":
        // con la API caída le afirmaba al usuario que no tiene datos.
        catchError(() => of({ ...this.aVista(query, [], 0, []), error: true })),
        startWith({ ...this.aVista(query, [], 0, []), cargando: true }),
      ),
    ),
  );

  readonly columns: TableColumn<TramiteVM>[] = [
    { key: 'titulo',    label: 'Título',      sortable: true, width: '30%' },
    { key: 'estado',    label: 'Estado',      sortable: true, width: '130px' },
    { key: 'modalidad', label: 'Modalidad',   sortable: true, hideOnMobile: true },
    { key: 'updatedAt', label: 'Actualizado', sortable: true, width: '160px', hideOnMobile: true },
    { key: 'acciones',  label: 'Acciones',    width: '140px' },
  ];

  private aVista(query: TramiteListQuery, rows: TramiteVM[], total: number, tabs: FilterTabOption[]): TramitesVista {
    const filtrosActivos = this.filtrosActivos();
    const hayFiltros = filtrosActivos.length > 0;
    return {
      cargando: false,
      error: false,
      rows,
      total,
      tabs,
      pageIndex: query.page,
      hayFiltros,
      filtrosActivos,
      ...this.estadoVacio(hayFiltros),
    };
  }

  // ── Filtros ─────────────────────────────────────────────────────────────

  /** El chip de estado y el select comparten control: son dos accesos al mismo filtro. */
  get estadoTabsActivo(): string {
    const estado = this.estadoCtrl.value;
    return estado === 'publicado' || estado === 'revision' ? estado : 'todos';
  }

  filtrarEstado(value: string): void {
    this.estadoCtrl.setValue(value === 'todos' ? '' : (value as TramiteEstado));
    this.pageIndex$.next(0);
  }

  limpiarFiltros(): void {
    this.searchCtrl.setValue('');
    this.organismoCtrl.setValue('');
    this.estadoCtrl.setValue('');
    this.localidadCtrl.setValue('');
    this.pageIndex$.next(0);
  }

  quitarFiltro(clave: string): void {
    switch (clave) {
      case 'search':    this.searchCtrl.setValue(''); break;
      case 'organismo': this.organismoCtrl.setValue(''); break;
      case 'estado':    this.estadoCtrl.setValue(''); break;
      case 'localidad': this.localidadCtrl.setValue(''); break;
    }
    this.pageIndex$.next(0);
  }

  private filtrosActivos(): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    const termino = this.searchCtrl.value.trim();
    if (termino) activos.push({ clave: 'search', etiqueta: `Búsqueda: ${termino}` });
    if (this.organismoCtrl.value) {
      activos.push({ clave: 'organismo', etiqueta: `Organismo: ${this.nombreOrganismo}` });
    }
    if (this.estadoCtrl.value) {
      const estado = ESTADOS.find((e) => e.value === this.estadoCtrl.value);
      activos.push({ clave: 'estado', etiqueta: `Estado: ${estado?.label ?? this.estadoCtrl.value}` });
    }
    if (this.localidadCtrl.value) {
      activos.push({ clave: 'localidad', etiqueta: `Localidad: ${this.nombreLocalidad}` });
    }
    return activos;
  }

  /** Nombres cacheados de los catálogos, para que el chip muestre el nombre y no el id. */
  private nombresOrganismo = new Map<string, string>();
  private nombresLocalidad = new Map<string, string>();

  private recordarNombres(organismos: RefVM[], localidades: RefVM[]): void {
    organismos.forEach((o) => this.nombresOrganismo.set(String(o.id), o.nombre));
    localidades.forEach((l) => this.nombresLocalidad.set(String(l.id), l.nombre));
  }

  private get nombreOrganismo(): string {
    return this.nombresOrganismo.get(String(this.organismoCtrl.value)) ?? 'seleccionado';
  }

  private get nombreLocalidad(): string {
    return this.nombresLocalidad.get(String(this.localidadCtrl.value)) ?? 'seleccionada';
  }

  private estadoVacio(hayFiltros: boolean): EstadoVacio {
    if (hayFiltros) {
      return {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ningún trámite coincide con la búsqueda o los filtros aplicados.',
        emptyActionLabel: 'Limpiar filtros',
      };
    }
    return {
      emptyTitle: 'Todavía no hay trámites',
      emptyMessage: 'Creá el primero para que la ciudadanía pueda encontrarlo en el portal.',
      emptyActionLabel: 'Nuevo trámite',
    };
  }

  onEmptyAction(): void {
    if (this.filtrosActivos().length > 0) {
      this.limpiarFiltros();
      return;
    }
    this.onCreate();
  }

  // ── Tabla ───────────────────────────────────────────────────────────────

  onSortChange(sort: TableSortEvent): void {
    this.sort$.next(sort);
  }

  onPageChange(evento: TablePageEvent): void {
    this.pageIndex$.next(evento.pageIndex);
    this.pageSize$.next(evento.pageSize);
  }

  recargar(): void {
    this.recargar$.next();
  }

  // ── Navegación ──────────────────────────────────────────────────────────

  onCreate(): void {
    this.router.navigate(['/dashboard/tramites/nuevo']);
  }

  onEdit(tramite: TramiteVM): void {
    this.router.navigate(['/dashboard/tramites/editar', tramite.id]);
  }

  onView(tramite: TramiteVM): void {
    this.router.navigate(['/dashboard/tramites/detalle', tramite.id]);
  }

  // ── Acciones de fila ────────────────────────────────────────────────────

  accionEditar(tramite: TramiteVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_PROCEDURE',
      run: () => this.onEdit(tramite),
    };
  }

  accionesDe(tramite: TramiteVM): RowAction[] {
    const acciones: RowAction[] = [
      {
        label: 'Ver detalle',
        icon: 'eye',
        permission: 'READ_PROCEDURE',
        ariaLabel: `Ver detalle de ${tramite.titulo}`,
        run: () => this.onView(tramite),
      },
      {
        label: 'Vista previa',
        icon: 'arrow-square-out',
        // La vista previa está sin implementar. Se muestra deshabilitada en vez de
        // ejecutar nada: antes era un `console.log` y el clic no hacía ni decía nada.
        disabled: true,
        run: () => undefined,
      },
    ];

    if (tramite.estado === 'borrador') {
      acciones.push({
        label: 'Enviar a revisión',
        icon: 'paper-plane-tilt',
        permission: 'UPDATE_PROCEDURE',
        run: () => this.enviarARevision(tramite),
      });
    }
    if (tramite.estado === 'revision') {
      acciones.push({
        label: 'Publicar',
        icon: 'cloud-arrow-up',
        permission: 'PUBLISH_VARIANT',
        run: () => this.publicar(tramite),
      });
    }
    if (tramite.estado === 'publicado') {
      acciones.push({
        label: 'Despublicar',
        icon: 'eye-slash',
        permission: 'PUBLISH_VARIANT',
        run: () => this.despublicar(tramite),
      });
    }

    acciones.push({
      label: 'Eliminar',
      icon: 'trash',
      permission: 'DELETE_PROCEDURE',
      danger: true,
      ariaLabel: `Eliminar trámite ${tramite.titulo}`,
      run: () => this.eliminar(tramite),
    });

    return acciones;
  }

  // ── Workflow ────────────────────────────────────────────────────────────

  /** Interna y reversible: no pide confirmación, pero sí avisa cómo salió. */
  private enviarARevision(tramite: TramiteVM): void {
    this.ejecutar(
      this.facade.sendToReview(tramite.id),
      tramite.id,
      'Trámite enviado a revisión',
      'No se pudo enviar a revisión.',
    );
  }

  /** De cara al ciudadano: se confirma antes, contando qué implica. */
  private publicar(tramite: TramiteVM): void {
    this.confirmarYEjecutar(tramite, {
      title: '¿Publicar el trámite?',
      message: `Se publicará ${tramite.titulo} y quedará visible para la ciudadanía en el portal público.`,
      confirmText: 'Sí, publicar',
      busyText: 'Publicando...',
      exito: 'Trámite publicado',
      fallo: 'No se pudo publicar el trámite.',
      accion: () => this.facade.publish(tramite.id),
    });
  }

  private despublicar(tramite: TramiteVM): void {
    this.confirmarYEjecutar(tramite, {
      title: '¿Despublicar el trámite?',
      message: `Se despublicará ${tramite.titulo} y dejará de verse en el portal público. Podés volver a publicarlo cuando quieras.`,
      confirmText: 'Sí, despublicar',
      busyText: 'Despublicando...',
      exito: 'Trámite despublicado',
      fallo: 'No se pudo despublicar el trámite.',
      accion: () => this.facade.unpublish(tramite.id),
    });
  }

  private eliminar(tramite: TramiteVM): void {
    this.confirmarYEjecutar(tramite, {
      title: '¿Eliminar el trámite?',
      message: `Se eliminará ${tramite.titulo} con toda su información, incluido el contenido por localidad. Esta acción no se puede deshacer.`,
      confirmText: 'Sí, eliminar',
      busyText: 'Eliminando...',
      danger: true,
      exito: 'Trámite eliminado',
      fallo: 'No se pudo eliminar el trámite.',
      accion: () => this.facade.delete(tramite.id),
    });
  }

  private confirmarYEjecutar(tramite: TramiteVM, opciones: {
    title: string; message: string; confirmText: string; busyText: string;
    danger?: boolean; exito: string; fallo: string; accion: () => Observable<unknown>;
  }): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: opciones.title,
        message: opciones.message,
        highlight: tramite.titulo,
        danger: opciones.danger ?? false,
        confirmText: opciones.confirmText,
        busyText: opciones.busyText,
        // El diálogo se queda abierto con el botón en spinner hasta que el backend
        // responde: si falla, sigue ahí para contarlo en vez de haber cerrado ya.
        confirmAction: () => {
          this.trabajandoId = tramite.id;
          this.cdr.markForCheck();
          return opciones.accion().pipe(
            finalize(() => { this.trabajandoId = null; this.cdr.markForCheck(); }),
          );
        },
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.snackBar.open(opciones.exito, 'OK', { duration: 3000, panelClass: 'snackbar-success' });
        this.recargar();
      });
  }

  /** Acción sin confirmación previa: bloquea la fila, avisa el resultado y recarga. */
  private ejecutar(accion$: Observable<unknown>, id: string, exito: string, fallo: string): void {
    this.trabajandoId = id;
    this.cdr.markForCheck();
    accion$
      .pipe(
        finalize(() => { this.trabajandoId = null; this.cdr.markForCheck(); }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open(exito, 'OK', { duration: 3000, panelClass: 'snackbar-success' });
          this.recargar();
        },
        // Antes estas acciones solo tenían `next`: si el backend rechazaba, el trámite
        // se quedaba igual y no aparecía nada que lo explicara.
        error: () => this.snackBar.open(fallo, 'Cerrar', { duration: 6000, panelClass: 'snackbar-error' }),
      });
  }
}
