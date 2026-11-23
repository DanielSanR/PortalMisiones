import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, filter, map, startWith } from 'rxjs';
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
import { ADOPTAR_ACCESS } from '@core/constants/policy-overrides.constants';
import { ListaCliente, compararTexto, textosDeVacio } from '@shared/utils/lista-cliente';
import { avisarError, avisarExito } from '@shared/utils/avisos';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { AdopcionOpcion, AdopcionVM, AdopcionesFacade, EstadoVigencia } from '@features/adopciones';
import { abrirFormDialog } from '@shared/utils/abrir-form-dialog';
import { dialogoDeAdoptar } from '../adoptar-dialogo';
import { VigenciaBadgeComponent } from '../components/vigencia-badge/vigencia-badge.component';
import { RUTA_DETALLE_ADOPCION } from '../adopciones.rutas';
import { confirmDeshabilitar } from '../adopcion-textos';
import { NO_DISPONIBLE } from '@core/constants/textos.constants';

/** Opciones del select "Estado", en el orden en que se leen. */
const ESTADOS: { valor: EstadoVigencia; etiqueta: string }[] = [
  { valor: 'vigente', etiqueta: 'Vigente' },
  { valor: 'programada', etiqueta: 'Programada' },
  { valor: 'vencida', etiqueta: 'Vencida' },
];

/** Orden del estado al ordenar la columna: lo vigente primero. */
const ORDEN_ESTADO: Record<EstadoVigencia, number> = { vigente: 0, programada: 1, vencida: 2 };

/** Filtros propios de la lista, con los organismos de los que sale el nombre del chip. */
interface FiltrosDeAdopciones {
  estado: EstadoVigencia | '';
  organismoId: string;
  organismos: AdopcionOpcion[];
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
    AtajoDirective,
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly adopciones$ = this.facade.adopciones$;
  readonly rutaDetalle = RUTA_DETALLE_ADOPCION;
  readonly noDisponible = NO_DISPONIBLE;
  readonly adoptarAccess = ADOPTAR_ACCESS;
  readonly estados = ESTADOS;

  /** '' = todos. */
  readonly estadoCtrl = new FormControl<EstadoVigencia | ''>('', { nonNullable: true });
  readonly organismoCtrl = new FormControl('', { nonNullable: true });
  private readonly estado$ = this.estadoCtrl.valueChanges.pipe(startWith(this.estadoCtrl.value));
  private readonly organismo$ = this.organismoCtrl.valueChanges.pipe(startWith(this.organismoCtrl.value));

  /** Organismos que aparecen en la lista (sin nombre = sin `READ_ORGANISM`: no hay filtro que ofrecer). */
  readonly organismos$ = this.adopciones$.pipe(map(organismosDeFiltro));

  /**
   * Búsqueda, filtros, orden, paginado y estado de carga en cliente sobre `adopciones$`.
   */
  readonly lista = new ListaCliente<AdopcionVM, FiltrosDeAdopciones>({
    fuente$: this.adopciones$,
    cargar: () => this.facade.loadAdopciones(),
    buscarEn: (a) => [a.plantillaTitulo, a.organismoNombre],
    comparar: (a, b, columna) => this.comparar(a, b, columna),
    filtros$: combineLatest([this.estado$, this.organismo$, this.organismos$]).pipe(
      map(([estado, organismoId, organismos]): FiltrosDeAdopciones => ({ estado, organismoId, organismos })),
    ),
    filtrar: (buscadas, { estado, organismoId }) => buscadas.filter((a) =>
      (!estado || a.estadoVigencia === estado) && (!organismoId || a.organismoId === organismoId)),
    filtrosActivos: (filtros) => this.filtrosActivos(filtros),
    limpiarFiltros: () => {
      this.estadoCtrl.setValue('');
      this.organismoCtrl.setValue('');
    },
    quitarFiltro: (clave) => {
      if (clave === 'estado') this.estadoCtrl.setValue('');
      if (clave === 'organismo') this.organismoCtrl.setValue('');
    },
    extras: textosDeVacio(
      {
        emptyTitle: 'Todavía no hay trámites del organismo',
        emptyMessage: 'Un trámite del organismo es una plantilla provincial que un organismo ofrece durante un período.',
        emptyActionLabel: 'Adoptar trámite',
      },
      {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ningún trámite coincide con la búsqueda o los filtros aplicados.',
        emptyActionLabel: 'Limpiar filtros',
      },
    ),
  });

  readonly columns: TableColumn<AdopcionVM>[] = [
    { key: 'plantilla', label: 'Trámite', sortable: true },
    { key: 'organismo', label: 'Organismo', sortable: true, hideOnMobile: true },
    { key: 'vigencia', label: 'Vigencia', sortable: true, hideOnMobile: true },
    { key: 'estado', label: 'Estado', sortable: true, width: '130px' },
    { key: 'acciones', label: 'Acciones', width: '140px' },
  ];

  ngOnInit(): void {
    this.lista.cargar();
    // El buscador de comandos ("Adoptar trámite") llega con `?adoptar=1`: abre el diálogo y limpia
    // la URL, para que volver atrás o recargar no lo reabra. Se escucha el stream (no el snapshot):
    // si el listado ya está montado, el router reutiliza el componente y solo cambia la query.
    this.route.queryParamMap
      .pipe(filter((params) => params.has('adoptar')), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.router.navigate([], { relativeTo: this.route, queryParams: { adoptar: null }, queryParamsHandling: 'merge', replaceUrl: true });
        if (this.facade.puedeAdoptar()) this.onAdoptar();
      });

    // Un organismo elegido que ya no está en la lista (se deshabilitó su última adopción) deja de filtrar.
    this.organismos$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((organismos) => {
        const elegido = this.organismoCtrl.value;
        // Mientras recarga la lista está vacía (`loadAdopciones` la vacía al empezar): no es que el
        // organismo haya desaparecido. Igual que en `fichas-list`.
        if (this.lista.cargando || !organismos.length) return;
        if (elegido && !organismos.some((o) => o.id === elegido)) this.organismoCtrl.setValue('');
      });
  }

  /** El CTA del estado vacío adopta o limpia según por qué está vacío. */
  onEmptyAction(hayFiltros: boolean): void {
    if (hayFiltros) {
      this.lista.limpiar();
      return;
    }
    this.onAdoptar();
  }

  /** El formulario se está abriendo (su código se baja en diferido): un segundo clic no abre otro. */
  private abriendo = false;

  async onAdoptar(): Promise<void> {
    // Con un diálogo ya abierto no se abre otro encima (doble clic): cada uno podría adoptar el trámite.
    if (this.abriendo || this.dialog.openDialogs.length) return;
    this.abriendo = true;
    try {
      const ref = await abrirFormDialog(this.dialog, dialogoDeAdoptar(this.facade));
      ref.afterClosed()
        .pipe(filter((creada): creada is AdopcionVM => !!creada), takeUntilDestroyed(this.destroyRef))
        .subscribe((creada) => {
          const texto = creada.estadoVigencia === 'programada'
            ? 'Trámite adoptado. Va a estar vigente desde la fecha de inicio'
            : 'Trámite adoptado';
          avisarExito(this.snackBar, texto, { accion: 'Ver', duracion: 5000 })
            .onAction()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.router.navigate([RUTA_DETALLE_ADOPCION, creada.id]));
        });
    } catch {
      avisarError(this.snackBar, 'No pudimos abrir el formulario. Intentá de nuevo.');
    } finally {
      this.abriendo = false;
    }
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
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: confirmDeshabilitar(adopcion, () => this.facade.deshabilitar(adopcion.id)),
      aviso: 'Trámite del organismo deshabilitado',
      ocupado: this.lista.ocupar(adopcion.id),
      // La fila deshabilitada sale de la lista: el foco va a la que ocupa su lugar.
      foco: { host: this.host },
    });
  }

  private comparar(a: AdopcionVM, b: AdopcionVM, key: string): number {
    switch (key) {
      case 'plantilla': return compararTexto(a.plantillaTitulo, b.plantillaTitulo);
      case 'organismo': return compararTexto(a.organismoNombre, b.organismoNombre);
      case 'vigencia': return a.vigenteDesde.getTime() - b.vigenteDesde.getTime();
      case 'estado': return ORDEN_ESTADO[a.estadoVigencia] - ORDEN_ESTADO[b.estadoVigencia];
      default: return 0;
    }
  }

  private filtrosActivos({ estado, organismoId, organismos }: FiltrosDeAdopciones): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
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
