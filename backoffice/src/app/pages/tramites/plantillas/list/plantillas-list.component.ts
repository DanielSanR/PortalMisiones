import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, filter, finalize, map, startWith } from 'rxjs';
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
import { buscarEn } from '@core/utils/list-filter.utils';
import { PlantillaOpcion, PlantillaVM, PlantillasFacade } from '@features/plantillas';
import { RUTA_DETALLE_PLANTILLA, RUTA_EDITAR_PLANTILLA, RUTA_NUEVA_PLANTILLA } from '../plantillas.rutas';

/** Texto de "no se pudo resolver el nombre" (id que no está en el catálogo). */
const NO_DISPONIBLE = 'No disponible';

/** Opciones de los selects de filtro, sacadas de lo que efectivamente usan las plantillas cargadas. */
interface OpcionesDeFiltro {
  categorias: PlantillaOpcion[];
  modalidades: PlantillaOpcion[];
}

interface PlantillasVista {
  /** Solo la página visible. */
  rows: PlantillaVM[];
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
 * Listado de plantillas provinciales. El backend devuelve la lista completa (solo activas) sin
 * paginar ni filtrar: búsqueda, filtros, orden y paginado son client-side sobre `plantillas$`.
 */
@Component({
  selector: 'app-plantillas-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
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
  ],
  templateUrl: './plantillas-list.component.html',
  styleUrl: './plantillas-list.component.scss',
})
export class PlantillasListComponent implements OnInit {
  private readonly facade = inject(PlantillasFacade);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly plantillas$ = this.facade.plantillas$;
  readonly rutaDetalle = RUTA_DETALLE_PLANTILLA;
  readonly noDisponible = NO_DISPONIBLE;

  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  /** Plantilla con una desactivación en vuelo, para bloquear su fila mientras dura. */
  desactivandoId: string | null = null;

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  /** '' = todas. */
  readonly categoriaCtrl = new FormControl('', { nonNullable: true });
  readonly modalidadCtrl = new FormControl('', { nonNullable: true });
  readonly sort$ = new BehaviorSubject<TableSortEvent | null>(null);
  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);

  private readonly search$ = this.searchCtrl.valueChanges.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    startWith(this.searchCtrl.value),
  );
  private readonly categoria$ = this.categoriaCtrl.valueChanges.pipe(startWith(this.categoriaCtrl.value));
  private readonly modalidad$ = this.modalidadCtrl.valueChanges.pipe(startWith(this.modalidadCtrl.value));

  readonly opciones$ = this.plantillas$.pipe(map(opcionesDeFiltro));

  readonly vista$ = combineLatest([
    this.plantillas$, this.opciones$, this.search$, this.categoria$, this.modalidad$,
    this.sort$, this.pageIndex$, this.pageSize$,
  ]).pipe(
    map(([plantillas, opciones, search, categoriaId, modalidadId, sort, pageIndex, pageSize]): PlantillasVista => {
      const filtradas = this.ordenar(
        buscarEn(plantillas, search, (x) => [x.titulo, x.slug])
          .filter((p) => (!categoriaId || p.categoriaPrincipal?.id === categoriaId || p.categorias.some((c) => c.id === categoriaId))
            && (!modalidadId || p.modalidad?.id === modalidadId)),
        sort,
      );
      // Al filtrar, la página actual puede quedar fuera de rango: se acota en vez de mostrar
      // una tabla vacía con resultados que sí existen.
      const ultimaPagina = Math.max(0, Math.ceil(filtradas.length / pageSize) - 1);
      const pagina = Math.min(pageIndex, ultimaPagina);
      const desde = pagina * pageSize;

      const filtrosActivos = this.filtrosActivos(search, categoriaId, modalidadId, opciones);
      const hayFiltros = filtrosActivos.length > 0;
      return {
        rows: filtradas.slice(desde, desde + pageSize),
        total: filtradas.length,
        pageIndex: pagina,
        hayFiltros,
        filtrosActivos,
        // Con filtros activos el CTA siempre limpia (aunque no haya plantillas); "Nueva" solo sin filtros.
        ...(hayFiltros
          ? {
            emptyTitle: 'Sin resultados',
            emptyMessage: 'Ninguna plantilla coincide con la búsqueda o los filtros aplicados.',
            emptyActionLabel: 'Limpiar filtros',
          }
          : {
            emptyTitle: 'Todavía no hay plantillas provinciales',
            emptyMessage: 'Creá la primera para que los organismos puedan adoptarla.',
            emptyActionLabel: 'Nueva plantilla',
          }),
      };
    }),
  );

  readonly columns: TableColumn<PlantillaVM>[] = [
    { key: 'titulo', label: 'Plantilla', sortable: true },
    { key: 'modalidad', label: 'Modalidad', sortable: true, hideOnMobile: true },
    { key: 'categoriaPrincipal', label: 'Categoría principal', sortable: true, hideOnMobile: true },
    { key: 'categorias', label: 'Categorías', sortable: true, hideOnMobile: true, width: '120px' },
    { key: 'etiquetas', label: 'Etiquetas', sortable: true, hideOnMobile: true, width: '110px' },
    { key: 'acciones', label: 'Acciones', width: '140px' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.facade.loadPlantillas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        // Sin esto la lista quedaría en el estado vacío, indistinguible de una carga fallida.
        error: () => { this.loading = false; this.error = true; this.cdr.markForCheck(); },
      });
  }

  limpiarFiltros(): void {
    this.searchCtrl.setValue('');
    this.categoriaCtrl.setValue('');
    this.modalidadCtrl.setValue('');
  }

  /** Quita un solo filtro desde su chip en la barra "Filtros activos". */
  quitarFiltro(clave: string): void {
    if (clave === 'search') this.searchCtrl.setValue('');
    if (clave === 'categoria') this.categoriaCtrl.setValue('');
    if (clave === 'modalidad') this.modalidadCtrl.setValue('');
  }

  /** El CTA del estado vacío crea o limpia según por qué está vacío. */
  onEmptyAction(hayFiltros: boolean): void {
    if (hayFiltros) {
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
    this.router.navigate([RUTA_NUEVA_PLANTILLA]);
  }

  accionEditar(plantilla: PlantillaVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_PROCEDURE',
      ariaLabel: `Editar plantilla ${plantilla.titulo}`,
      run: () => this.router.navigate([RUTA_EDITAR_PLANTILLA, plantilla.id]),
    };
  }

  accionesDe(plantilla: PlantillaVM): RowAction[] {
    return [
      {
        label: 'Ver detalle',
        icon: 'eye',
        permission: 'READ_PROCEDURE',
        run: () => this.router.navigate([RUTA_DETALLE_PLANTILLA, plantilla.id]),
      },
      {
        label: 'Desactivar',
        icon: 'prohibit',
        permission: 'DELETE_PROCEDURE',
        danger: true,
        ariaLabel: `Desactivar plantilla ${plantilla.titulo}`,
        run: () => this.onDesactivar(plantilla),
      },
    ];
  }

  onDesactivar(plantilla: PlantillaVM): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '¿Desactivar la plantilla?',
        message: `La plantilla ${plantilla.titulo} deja de listarse acá y no se va a poder adoptar. `
          + 'Por ahora no hay forma de verla ni reactivarla desde el listado.',
        highlight: plantilla.titulo,
        danger: true,
        confirmText: 'Sí, desactivar',
        busyText: 'Desactivando...',
        confirmAction: () => {
          this.desactivandoId = plantilla.id;
          this.cdr.markForCheck();
          return this.facade.desactivar(plantilla.id).pipe(
            finalize(() => { this.desactivandoId = null; this.cdr.markForCheck(); }),
          );
        },
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open('Plantilla desactivada', 'OK', {
        duration: 3000,
        panelClass: 'snackbar-success',
      }));
  }

  private ordenar(plantillas: PlantillaVM[], sort: TableSortEvent | null): PlantillaVM[] {
    if (!sort?.direction) return plantillas;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...plantillas].sort((a, b) => this.comparar(a, b, sort.active) * factor);
  }

  private comparar(a: PlantillaVM, b: PlantillaVM, key: string): number {
    switch (key) {
      case 'categorias': return a.categorias.length - b.categorias.length;
      case 'etiquetas': return a.etiquetas.length - b.etiquetas.length;
      default:
        return this.textoDeOrden(a, key).localeCompare(this.textoDeOrden(b, key), 'es-AR', { sensitivity: 'base' });
    }
  }

  private textoDeOrden(p: PlantillaVM, key: string): string {
    switch (key) {
      case 'titulo': return p.titulo;
      case 'modalidad': return p.modalidad?.nombre ?? '';
      case 'categoriaPrincipal': return p.categoriaPrincipal?.nombre ?? '';
      default: return '';
    }
  }

  private filtrosActivos(search: string, categoriaId: string, modalidadId: string, opciones: OpcionesDeFiltro): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    const termino = search.trim();
    if (termino) activos.push({ clave: 'search', etiqueta: `Búsqueda: ${termino}` });
    if (categoriaId) {
      const nombre = opciones.categorias.find((o) => o.id === categoriaId)?.nombre ?? NO_DISPONIBLE;
      activos.push({ clave: 'categoria', etiqueta: `Categoría: ${nombre}` });
    }
    if (modalidadId) {
      const nombre = opciones.modalidades.find((o) => o.id === modalidadId)?.nombre ?? NO_DISPONIBLE;
      activos.push({ clave: 'modalidad', etiqueta: `Modalidad: ${nombre}` });
    }
    return activos;
  }
}

/** Categorías (principal o no) y modalidades que usa al menos una plantilla, sin repetir y ordenadas. */
function opcionesDeFiltro(plantillas: PlantillaVM[]): OpcionesDeFiltro {
  const categorias = new Map<string, string>();
  const modalidades = new Map<string, string>();
  for (const p of plantillas) {
    for (const c of [...(p.categoriaPrincipal ? [p.categoriaPrincipal] : []), ...p.categorias]) {
      categorias.set(c.id, c.nombre ?? NO_DISPONIBLE);
    }
    if (p.modalidad) modalidades.set(p.modalidad.id, p.modalidad.nombre ?? NO_DISPONIBLE);
  }
  const ordenadas = (m: Map<string, string>): PlantillaOpcion[] => [...m]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR', { sensitivity: 'base' }));
  return { categorias: ordenadas(categorias), modalidades: ordenadas(modalidades) };
}
