import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, filter, finalize, map, merge, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SharedTableComponent, TableCellDirective, TableColumn, TablePageEvent, TableSortEvent } from '../../../../shared/components/table';
import { RowAction, RowActionsComponent } from '../../../../shared/components/row-actions';
import { ListSearchComponent } from '../../../../shared/components/list-search';
import { ActiveFiltersComponent, FiltroActivo } from '../../../../shared/components/active-filters';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../../shared/directives/page-actions.directive';
import { ADOPTAR_ACCESS } from '@core/constants/policy-overrides.constants';
import { buscarEn } from '@core/utils/list-filter.utils';
import { AdopcionOpcion, AdopcionVM, AdopcionesFacade, EstadoVigencia } from '@features/adopciones';
import { AdoptarDialogComponent } from '../adoptar-dialog/adoptar-dialog.component';
import { VigenciaBadgeComponent } from '../vigencia-badge/vigencia-badge.component';
import { NO_DISPONIBLE } from '../adopcion-save-error';
import { RUTA_DETALLE_ADOPCION } from '../adopciones.rutas';
import { confirmDeshabilitar } from '../adopcion-textos';

/** Opciones del select "Estado", en el orden en que se leen. */
const ESTADOS: { valor: EstadoVigencia; etiqueta: string }[] = [
  { valor: 'vigente', etiqueta: 'Vigente' },
  { valor: 'programada', etiqueta: 'Programada' },
  { valor: 'vencida', etiqueta: 'Vencida' },
];

/** Orden del estado al ordenar la columna: lo vigente primero. */
const ORDEN_ESTADO: Record<EstadoVigencia, number> = { vigente: 0, programada: 1, vencida: 2 };

interface AdopcionesVista {
  /** Solo la página visible. */
  rows: AdopcionVM[];
  /** Total tras filtrar (lo que cuenta el toolbar y alimenta al paginador). */
  total: number;
  pageIndex: number;
  hayFiltros: boolean;
  filtrosActivos: FiltroActivo[];
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
}

/**
 * "Trámites del organismo": adopciones habilitadas del alcance del usuario (SA/AB: todas; AO: las de
 * su organismo). El backend devuelve la lista completa sin paginar ni filtrar: búsqueda, filtros,
 * orden y paginado son client-side sobre `adopciones$`. Las deshabilitadas no se muestran (P-4).
 */
@Component({
  selector: 'app-adopciones-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    RowActionsComponent,
    ListSearchComponent,
    ActiveFiltersComponent,
    HasPermissionDirective,
    PageActionsDirective,
    VigenciaBadgeComponent,
  ],
  templateUrl: './adopciones-list.component.html',
  styleUrl: './adopciones-list.component.scss',
})
export class AdopcionesListComponent implements OnInit {
  private readonly facade = inject(AdopcionesFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly adopciones$ = this.facade.adopciones$;
  readonly rutaDetalle = RUTA_DETALLE_ADOPCION;
  readonly noDisponible = NO_DISPONIBLE;
  readonly adoptarAccess = ADOPTAR_ACCESS;
  readonly estados = ESTADOS;

  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  /** Adopción con una deshabilitación en vuelo, para bloquear su fila mientras dura. */
  deshabilitandoId: string | null = null;

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  /** '' = todos. */
  readonly estadoCtrl = new FormControl<EstadoVigencia | ''>('', { nonNullable: true });
  readonly organismoCtrl = new FormControl('', { nonNullable: true });
  readonly sort$ = new BehaviorSubject<TableSortEvent | null>(null);
  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);

  private readonly search$ = this.searchCtrl.valueChanges.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    startWith(this.searchCtrl.value),
  );
  private readonly estado$ = this.estadoCtrl.valueChanges.pipe(startWith(this.estadoCtrl.value));
  private readonly organismo$ = this.organismoCtrl.valueChanges.pipe(startWith(this.organismoCtrl.value));

  /** Organismos que aparecen en la lista (sin nombre = sin `READ_ORGANISM`: no hay filtro que ofrecer). */
  readonly organismos$ = this.adopciones$.pipe(map(organismosDeFiltro));

  readonly vista$ = combineLatest([
    this.adopciones$, this.organismos$, this.search$, this.estado$, this.organismo$,
    this.sort$, this.pageIndex$, this.pageSize$,
  ]).pipe(
    map(([adopciones, organismos, search, estado, organismoId, sort, pageIndex, pageSize]): AdopcionesVista => {
      const filtradas = this.ordenar(
        adopciones
          .filter((a) => !estado || a.estadoVigencia === estado)
          .filter((a) => !organismoId || a.organismoId === organismoId)
          .filter((a) => buscarEn([a], search, (x) => [x.plantillaTitulo ?? '', x.organismoNombre ?? '']).length > 0),
        sort,
      );
      // Al filtrar, la página actual puede quedar fuera de rango: se acota en vez de mostrar
      // una tabla vacía con resultados que sí existen.
      const ultimaPagina = Math.max(0, Math.ceil(filtradas.length / pageSize) - 1);
      const pagina = Math.min(pageIndex, ultimaPagina);
      const desde = pagina * pageSize;

      const filtrosActivos = this.filtrosActivos(search, estado, organismoId, organismos);
      const hayFiltros = filtrosActivos.length > 0;
      return {
        rows: filtradas.slice(desde, desde + pageSize),
        total: filtradas.length,
        pageIndex: pagina,
        hayFiltros,
        filtrosActivos,
        ...(adopciones.length > 0 && hayFiltros
          ? {
            emptyTitle: 'Sin resultados',
            emptyMessage: 'Ningún trámite coincide con la búsqueda o los filtros aplicados.',
            emptyActionLabel: 'Limpiar filtros',
          }
          : {
            emptyTitle: 'Todavía no hay trámites del organismo',
            emptyMessage: 'Un trámite del organismo es una plantilla provincial que un organismo ofrece durante un período.',
            emptyActionLabel: 'Adoptar trámite',
          }),
      };
    }),
  );

  readonly columns: TableColumn<AdopcionVM>[] = [
    { key: 'plantilla', label: 'Trámite', sortable: true },
    { key: 'organismo', label: 'Organismo', sortable: true, hideOnMobile: true },
    { key: 'vigencia', label: 'Vigencia', sortable: true, hideOnMobile: true },
    { key: 'estado', label: 'Estado', sortable: true, width: '130px' },
    { key: 'acciones', label: 'Acciones', width: '140px' },
  ];

  ngOnInit(): void {
    this.load();
    // El buscador de comandos ("Adoptar trámite") llega con `?adoptar=1`: abre el diálogo y limpia
    // la URL, para que volver atrás o recargar no lo reabra. Se escucha el stream (no el snapshot):
    // si el listado ya está montado, el router reutiliza el componente y solo cambia la query.
    this.route.queryParamMap
      .pipe(filter((params) => params.has('adoptar')), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.router.navigate([], { relativeTo: this.route, queryParams: { adoptar: null }, queryParamsHandling: 'merge', replaceUrl: true });
        if (this.facade.puedeAdoptar()) this.onAdoptar();
      });

    // Cambiar un filtro vuelve a la primera página (si no, al limpiarlo la tabla salta a una página vieja).
    merge(this.searchCtrl.valueChanges, this.estadoCtrl.valueChanges, this.organismoCtrl.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.pageIndex$.next(0));

    // Un organismo elegido que ya no está en la lista (se deshabilitó su última adopción) deja de filtrar.
    this.organismos$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((organismos) => {
        const elegido = this.organismoCtrl.value;
        if (elegido && !organismos.some((o) => o.id === elegido)) this.organismoCtrl.setValue('');
      });
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.facade.loadAdopciones()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        // Sin esto la lista quedaría en el estado vacío, indistinguible de una carga fallida.
        error: () => { this.loading = false; this.error = true; this.cdr.markForCheck(); },
      });
  }

  limpiarFiltros(): void {
    this.searchCtrl.setValue('');
    this.estadoCtrl.setValue('');
    this.organismoCtrl.setValue('');
  }

  /** Quita un solo filtro desde su chip en la barra "Filtros activos". */
  quitarFiltro(clave: string): void {
    if (clave === 'search') this.searchCtrl.setValue('');
    if (clave === 'estado') this.estadoCtrl.setValue('');
    if (clave === 'organismo') this.organismoCtrl.setValue('');
  }

  /** El CTA del estado vacío adopta o limpia según por qué está vacío. */
  onEmptyAction(hayFiltros: boolean): void {
    if (hayFiltros) {
      this.limpiarFiltros();
      return;
    }
    this.onAdoptar();
  }

  onSortChange(sort: TableSortEvent): void {
    this.sort$.next(sort);
  }

  onPageChange(evento: TablePageEvent): void {
    this.pageIndex$.next(evento.pageIndex);
    this.pageSize$.next(evento.pageSize);
  }

  onAdoptar(): void {
    this.dialog.open<AdoptarDialogComponent, void, AdopcionVM>(AdoptarDialogComponent, {
      panelClass: 'custom-modal-panel',
      autoFocus: 'first-tabbable',
    })
      .afterClosed()
      .pipe(filter((creada): creada is AdopcionVM => !!creada), takeUntilDestroyed(this.destroyRef))
      .subscribe((creada) => {
        const texto = creada.estadoVigencia === 'programada'
          ? 'Trámite adoptado. Va a estar vigente desde la fecha de inicio'
          : 'Trámite adoptado';
        this.snackBar.open(texto, 'Ver', { duration: 5000, panelClass: 'snackbar-success' })
          .onAction()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => this.router.navigate([RUTA_DETALLE_ADOPCION, creada.id]));
      });
  }

  accionVer(adopcion: AdopcionVM): RowAction {
    return {
      label: 'Ver detalle',
      icon: 'eye',
      permission: 'READ_ADOPTION',
      ariaLabel: `Ver el trámite ${adopcion.plantillaTitulo ?? ''} del organismo`,
      run: () => this.router.navigate([RUTA_DETALLE_ADOPCION, adopcion.id]),
    };
  }

  accionesDe(adopcion: AdopcionVM): RowAction[] {
    return [
      {
        label: 'Deshabilitar',
        icon: 'prohibit',
        permission: 'DELETE_ADOPTION',
        danger: true,
        ariaLabel: `Deshabilitar el trámite ${adopcion.plantillaTitulo ?? ''} del organismo`,
        run: () => this.onDeshabilitar(adopcion),
      },
    ];
  }

  onDeshabilitar(adopcion: AdopcionVM): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: confirmDeshabilitar(adopcion, () => {
        this.deshabilitandoId = adopcion.id;
        this.cdr.markForCheck();
        return this.facade.deshabilitar(adopcion.id).pipe(
          finalize(() => { this.deshabilitandoId = null; this.cdr.markForCheck(); }),
        );
      }),
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open('Trámite del organismo deshabilitado', 'OK', {
        duration: 3000,
        panelClass: 'snackbar-success',
      }));
  }

  private ordenar(adopciones: AdopcionVM[], sort: TableSortEvent | null): AdopcionVM[] {
    if (!sort?.direction) return adopciones;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...adopciones].sort((a, b) => this.comparar(a, b, sort.active) * factor);
  }

  private comparar(a: AdopcionVM, b: AdopcionVM, key: string): number {
    const texto = (x: string | null, y: string | null) => (x ?? '').localeCompare(y ?? '', 'es-AR', { sensitivity: 'base' });
    switch (key) {
      case 'plantilla': return texto(a.plantillaTitulo, b.plantillaTitulo);
      case 'organismo': return texto(a.organismoNombre, b.organismoNombre);
      case 'vigencia': return a.vigenteDesde.getTime() - b.vigenteDesde.getTime();
      case 'estado': return ORDEN_ESTADO[a.estadoVigencia] - ORDEN_ESTADO[b.estadoVigencia];
      default: return 0;
    }
  }

  private filtrosActivos(search: string, estado: EstadoVigencia | '', organismoId: string, organismos: AdopcionOpcion[]): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    const termino = search.trim();
    if (termino) activos.push({ clave: 'search', etiqueta: `Búsqueda: ${termino}` });
    if (estado) {
      activos.push({ clave: 'estado', etiqueta: `Estado: ${ESTADOS.find((e) => e.valor === estado)?.etiqueta ?? estado}` });
    }
    if (organismoId) {
      const nombre = organismos.find((o) => o.id === organismoId)?.nombre ?? NO_DISPONIBLE;
      activos.push({ clave: 'organismo', etiqueta: `Organismo: ${nombre}` });
    }
    return activos;
  }
}

/** Organismos con nombre que usa al menos una adopción, sin repetir y ordenados. */
function organismosDeFiltro(adopciones: AdopcionVM[]): AdopcionOpcion[] {
  const organismos = new Map<string, string>();
  for (const a of adopciones) {
    if (a.organismoNombre) organismos.set(a.organismoId, a.organismoNombre);
  }
  return [...organismos]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR', { sensitivity: 'base' }));
}
