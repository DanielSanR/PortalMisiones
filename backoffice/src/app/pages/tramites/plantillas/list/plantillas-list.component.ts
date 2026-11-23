import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { combineLatest, map, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SharedTableComponent, TableCellDirective, TableColumn } from '@shared/components/table';
import { RowAction, RowActionsComponent } from '@shared/components/row-actions';
import { ListSearchComponent } from '@shared/components/list-search';
import { AtajoDirective } from '@shared/directives/atajo.directive';
import { ActiveFiltersComponent, FiltroActivo } from '@shared/components/active-filters';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { PageActionsDirective } from '@shared/directives/page-actions.directive';
import { ListaCliente, textosDeVacio } from '@shared/utils/lista-cliente';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { PlantillaOpcion, PlantillaVM, PlantillasFacade } from '@features/plantillas';
import { RUTA_DETALLE_PLANTILLA, RUTA_EDITAR_PLANTILLA, RUTA_NUEVA_PLANTILLA } from '../plantillas.rutas';
import { NO_DISPONIBLE } from '@core/constants/textos.constants';

/** Opciones de los selects de filtro, sacadas de lo que efectivamente usan las plantillas cargadas. */
interface OpcionesDeFiltro {
  categorias: PlantillaOpcion[];
  modalidades: PlantillaOpcion[];
}

/** Filtros propios de la lista, con las opciones de las que sale el nombre de cada chip. */
interface FiltrosDePlantillas {
  categoriaId: string;
  modalidadId: string;
  opciones: OpcionesDeFiltro;
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
    AtajoDirective,
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly plantillas$ = this.facade.plantillas$;
  readonly rutaDetalle = RUTA_DETALLE_PLANTILLA;
  readonly noDisponible = NO_DISPONIBLE;

  /** '' = todas. */
  readonly categoriaCtrl = new FormControl('', { nonNullable: true });
  readonly modalidadCtrl = new FormControl('', { nonNullable: true });
  private readonly categoria$ = this.categoriaCtrl.valueChanges.pipe(startWith(this.categoriaCtrl.value));
  private readonly modalidad$ = this.modalidadCtrl.valueChanges.pipe(startWith(this.modalidadCtrl.value));

  readonly opciones$ = this.plantillas$.pipe(map(opcionesDeFiltro));

  /** Búsqueda, filtros, orden, paginado y estado de carga en cliente sobre `plantillas$`. */
  readonly lista = new ListaCliente<PlantillaVM, FiltrosDePlantillas>({
    fuente$: this.plantillas$,
    cargar: () => this.facade.loadPlantillas(),
    buscarEn: (p) => [p.titulo, p.slug],
    comparar: (a, b, columna) => this.comparar(a, b, columna),
    filtros$: combineLatest([this.categoria$, this.modalidad$, this.opciones$]).pipe(
      map(([categoriaId, modalidadId, opciones]): FiltrosDePlantillas => ({ categoriaId, modalidadId, opciones })),
    ),
    filtrar: (buscadas, { categoriaId, modalidadId }) => buscadas.filter((p) =>
      (!categoriaId || p.categoriaPrincipal?.id === categoriaId || p.categorias.some((c) => c.id === categoriaId))
      && (!modalidadId || p.modalidad?.id === modalidadId)),
    filtrosActivos: (filtros) => this.filtrosActivos(filtros),
    limpiarFiltros: () => {
      this.categoriaCtrl.setValue('');
      this.modalidadCtrl.setValue('');
    },
    quitarFiltro: (clave) => {
      if (clave === 'categoria') this.categoriaCtrl.setValue('');
      if (clave === 'modalidad') this.modalidadCtrl.setValue('');
    },
    extras: textosDeVacio(
      {
        emptyTitle: 'Todavía no hay plantillas provinciales',
        emptyMessage: 'Creá la primera para que los organismos puedan adoptarla.',
        emptyActionLabel: 'Nueva plantilla',
      },
      {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ninguna plantilla coincide con la búsqueda o los filtros aplicados.',
        emptyActionLabel: 'Limpiar filtros',
      },
    ),
  });

  readonly columns: TableColumn<PlantillaVM>[] = [
    { key: 'titulo', label: 'Plantilla', sortable: true },
    { key: 'modalidad', label: 'Modalidad', sortable: true, hideOnMobile: true },
    { key: 'categoriaPrincipal', label: 'Categoría principal', sortable: true, hideOnMobile: true },
    { key: 'categorias', label: 'Categorías', sortable: true, hideOnMobile: true, width: '120px' },
    { key: 'etiquetas', label: 'Etiquetas', sortable: true, hideOnMobile: true, width: '110px' },
    { key: 'acciones', label: 'Acciones', width: '140px' },
  ];

  ngOnInit(): void {
    this.lista.cargar();
  }

  /** El CTA del estado vacío crea o limpia según por qué está vacío. */
  onEmptyAction(hayFiltros: boolean): void {
    if (hayFiltros) {
      this.lista.limpiar();
      return;
    }
    this.onCreate();
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
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: {
        title: '¿Desactivar la plantilla?',
        message: `La plantilla ${plantilla.titulo} deja de listarse acá y no se va a poder adoptar. `
          + 'Por ahora no hay forma de verla ni reactivarla desde el listado.',
        highlight: plantilla.titulo,
        danger: true,
        confirmText: 'Sí, desactivar',
        busyText: 'Desactivando…',
        confirmAction: () => this.facade.desactivar(plantilla.id),
      },
      aviso: 'Plantilla desactivada',
      ocupado: this.lista.ocupar(plantilla.id),
      // La plantilla desactivada sale de la lista: el foco va a la fila que ocupa su lugar.
      foco: { host: this.host },
    });
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

  private filtrosActivos({ categoriaId, modalidadId, opciones }: FiltrosDePlantillas): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
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
