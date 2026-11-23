import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, combineLatest, map, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { SharedTableComponent, TableCellDirective, TableColumn } from '@shared/components/table';
import { RowAction, RowActionsComponent } from '@shared/components/row-actions';
import { ListSearchComponent } from '@shared/components/list-search';
import { ActiveFiltersComponent, FiltroActivo } from '@shared/components/active-filters';
import { FilterTabOption, FilterTabsComponent } from '@shared/components/filter-tabs';
import { EstadoBadgeComponent } from '@shared/components/estado-badge/estado-badge.component';
import { AtajoDirective } from '@shared/directives/atajo.directive';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { PageActionsDirective } from '@shared/directives/page-actions.directive';
import { CREAR_FICHA_ACCESS } from '@core/constants/policy-overrides.constants';
import { ESTADOS_PUBLICACION, ETIQUETA_ESTADO_PUBLICACION } from '@core/models/estado-publicacion.model';
import { ListaCliente, VistaDeLista, compararTexto } from '@shared/utils/lista-cliente';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import {
  AccionWorkflow, EstadoFicha, FichaLocalVM, FichasLocalesFacade, ResolverAccionesWorkflow,
} from '@features/fichas-locales';
import {
  ACCIONES_UI, TEXTO_FUENTE_SIMULADA, confirmAccion, confirmDesactivar, nombreDeFicha, textoExito,
} from '../ficha-textos';
import { FRAGMENTO_PUNTOS, RUTA_DETALLE_FICHA, RUTA_EDITAR_FICHA, RUTA_NUEVA_FICHA } from '../fichas.rutas';
import { NO_DISPONIBLE } from '@core/constants/textos.constants';

type Tab = 'todas' | 'revision';

/** Orden del estado al ordenar la columna: el del workflow. */
const ORDEN_ESTADO: Record<EstadoFicha, number> = { BORRADOR: 0, EN_REVISION: 1, PUBLICADO: 2, DESPUBLICADO: 3 };

interface Opcion {
  id: string;
  nombre: string;
}

/** Filtros propios de la lista (la tab filtra, pero no cuenta como filtro activo), con las localidades de los chips. */
interface FiltrosDeFichas {
  tab: Tab;
  estado: EstadoFicha | '';
  localidadId: string;
  inactivas: boolean;
  localidades: Opcion[];
}

/** Textos del vacío y qué ofrece su botón. */
interface VacioDeFichas {
  emptyTitle: string;
  emptyMessage: string;
  /** Qué ofrece el botón del estado vacío: limpiar los filtros, crear la primera ficha, o nada (bandeja vacía). */
  emptyAccion: 'limpiar' | 'nueva' | null;
  emptyActionLabel: string;
  emptyActionIcon: string;
}

type FichasVista = VistaDeLista<FichaLocalVM, FiltrosDeFichas> & VacioDeFichas & {
  /** Acciones de workflow con la sesión vigente (del facade): las lee el menú de cada fila. */
  accionesWorkflow: ResolverAccionesWorkflow;
};

/**
 * "Fichas por localidad": todas las fichas del alcance (SA/MANAGER: todas; AO/AGENT: las de su
 * organismo). El backend devuelve la lista completa sin paginar ni filtrar: tabs, búsqueda, filtros,
 * orden y paginado son client-side sobre `fichas$`.
 *
 * - Tab "En revisión" (bandeja de publicación): solo con `PUBLISH_VARIANT`, con el contador de las
 *   activas pendientes. El nav no soporta badges: el contador vive acá.
 * - Las desactivadas (el backend las lista) se ocultan salvo con "Mostrar desactivadas".
 * - Las acciones de workflow de cada fila salen de `accionesWorkflow$` del facade (permiso, nunca rol: D-3).
 * - "Nueva ficha" (`CREAR_FICHA_ACCESS`, atajo N) en el header y en el estado vacío: abre el alta, que deja elegir
 *   el trámite del organismo del que cuelga. También se agrega desde el detalle de un trámite del organismo.
 * - La acción de fila "Puntos de atención" (`READ_ATTENTION_POINT`) abre el detalle con el foco en ese panel.
 */
@Component({
  selector: 'app-fichas-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    RowActionsComponent,
    ListSearchComponent,
    ActiveFiltersComponent,
    FilterTabsComponent,
    EstadoBadgeComponent,
    PageActionsDirective,
    HasPermissionDirective,
    AtajoDirective,
  ],
  templateUrl: './fichas-list.component.html',
  styleUrl: './fichas-list.component.scss',
})
export class FichasListComponent implements OnInit {
  private readonly facade = inject(FichasLocalesFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly fichas$ = this.facade.fichas$;
  /** La fuente es simulada: aviso persistente, nada de lo que se haga llega al servidor. */
  readonly fuenteSimulada = this.facade.fuenteSimulada;
  readonly textoFuenteSimulada = TEXTO_FUENTE_SIMULADA;
  readonly rutaDetalle = RUTA_DETALLE_FICHA;
  readonly crearFicha = CREAR_FICHA_ACCESS;
  readonly noDisponible = NO_DISPONIBLE;
  readonly estados = ESTADOS_PUBLICACION.map((valor) => ({ valor, etiqueta: ETIQUETA_ESTADO_PUBLICACION[valor] }));

  /** '' = todos. */
  readonly estadoCtrl = new FormControl<EstadoFicha | ''>('', { nonNullable: true });
  readonly localidadCtrl = new FormControl('', { nonNullable: true });
  readonly inactivasCtrl = new FormControl(false, { nonNullable: true });
  readonly tab$ = new BehaviorSubject<Tab>('todas');

  /** Reactivo a la sesión: la bandeja "En revisión" es de quien puede publicar (`PUBLISH_VARIANT`). */
  readonly puedePublicar$: Observable<boolean> = this.facade.puedePublicar$;

  private readonly estado$ = this.estadoCtrl.valueChanges.pipe(startWith(this.estadoCtrl.value));
  private readonly localidad$ = this.localidadCtrl.valueChanges.pipe(startWith(this.localidadCtrl.value));
  private readonly inactivas$ = this.inactivasCtrl.valueChanges.pipe(startWith(this.inactivasCtrl.value));

  /** Sin `PUBLISH_VARIANT` la tab de revisión no existe: se trata como "todas". */
  private readonly tabEfectiva$ = combineLatest([this.tab$, this.puedePublicar$]).pipe(
    map(([tab, puede]): Tab => (puede ? tab : 'todas')),
  );

  /** Localidades con nombre que aparecen en la lista (sin nombre no hay filtro que ofrecer). */
  readonly localidades$ = this.fichas$.pipe(map(localidadesDeFiltro));

  readonly filterTabs$: Observable<FilterTabOption[]> = combineLatest([this.fichas$, this.puedePublicar$]).pipe(
    map(([fichas, puede]) => {
      if (!puede) return [];
      const enRevision = fichas.filter((f) => f.activa && f.estado === 'EN_REVISION').length;
      return [
        { value: 'todas', label: 'Todas' },
        { value: 'revision', label: 'En revisión', count: enRevision, alert: enRevision > 0 },
      ];
    }),
  );

  /**
   * Búsqueda, filtros, orden, paginado y estado de carga en cliente sobre `fichas$`.
   */
  readonly lista = new ListaCliente<FichaLocalVM, FiltrosDeFichas, VacioDeFichas>({
    fuente$: this.fichas$,
    cargar: () => this.facade.loadFichas(),
    buscarEn: (f) => [f.plantillaTitulo, f.organismoNombre, f.localidadNombre, f.slug],
    comparar: (a, b, columna) => this.comparar(a, b, columna),
    filtros$: combineLatest([this.tabEfectiva$, this.estado$, this.localidad$, this.inactivas$, this.localidades$]).pipe(
      map(([tab, estado, localidadId, inactivas, localidades]): FiltrosDeFichas => ({ tab, estado, localidadId, inactivas, localidades })),
    ),
    filtrar: (buscadas, { tab, estado, localidadId, inactivas }) => buscadas.filter((f) => (inactivas || f.activa)
      && (tab !== 'revision' || (f.activa && f.estado === 'EN_REVISION'))
      && (!estado || f.estado === estado)
      && (!localidadId || f.localidadId === localidadId)),
    filtrosActivos: (filtros) => this.filtrosActivos(filtros),
    limpiarFiltros: () => {
      this.estadoCtrl.setValue('');
      this.localidadCtrl.setValue('');
      this.inactivasCtrl.setValue(false);
    },
    quitarFiltro: (clave) => {
      if (clave === 'estado') this.estadoCtrl.setValue('');
      if (clave === 'localidad') this.localidadCtrl.setValue('');
      if (clave === 'inactivas') this.inactivasCtrl.setValue(false);
    },
    extras: ({ items, hayFiltros, filtros }) => this.textosVacio(items.length > 0, hayFiltros, filtros.tab),
  });

  /** Vista propia (no `lista.vista$` a secas): le suma las acciones de workflow que habilita la sesión. */
  readonly vista$: Observable<FichasVista> = combineLatest([this.lista.vista$, this.facade.accionesWorkflow$]).pipe(
    map(([vista, accionesWorkflow]): FichasVista => ({ ...vista, accionesWorkflow })),
  );

  readonly columns: TableColumn<FichaLocalVM>[] = [
    { key: 'tramite', label: 'Trámite', sortable: true },
    { key: 'localidad', label: 'Localidad', sortable: true, hideOnMobile: true },
    { key: 'estado', label: 'Estado', sortable: true, width: '170px' },
    { key: 'version', label: 'Versión', sortable: true, width: '90px', hideOnMobile: true },
    { key: 'acciones', label: 'Acciones', width: '140px' },
  ];

  ngOnInit(): void {
    this.lista.cargar();

    // `?tab=revision` (buscador de comandos) abre la bandeja.
    this.route.queryParamMap
      .pipe(map((params) => params.get('tab')), takeUntilDestroyed(this.destroyRef))
      .subscribe((tab) => this.tab$.next(tab === 'revision' ? 'revision' : 'todas'));

    // Una localidad elegida que ya no está en la lista deja de filtrar.
    this.localidades$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((localidades) => {
        const elegida = this.localidadCtrl.value;
        // Mientras recarga la lista está vacía: no es que la localidad haya desaparecido.
        if (this.lista.cargando || !localidades.length) return;
        if (elegida && !localidades.some((l) => l.id === elegida)) this.localidadCtrl.setValue('');
      });
  }

  cambiarTab(tab: string): void {
    this.tab$.next(tab === 'revision' ? 'revision' : 'todas');
  }

  accionVer(ficha: FichaLocalVM): RowAction {
    return {
      label: 'Ver detalle',
      icon: 'eye',
      permission: 'READ_VARIANT',
      ariaLabel: `Ver la ficha ${nombreDeFicha(ficha)}`,
      run: () => this.router.navigate([RUTA_DETALLE_FICHA, ficha.id]),
    };
  }

  /** Alta de una ficha: el formulario deja elegir el trámite del organismo del que cuelga. */
  onNueva(): void {
    this.router.navigate([RUTA_NUEVA_FICHA]);
  }

  onEmptyAction(accion: FichasVista['emptyAccion']): void {
    if (accion === 'limpiar') this.lista.limpiar();
    if (accion === 'nueva') this.onNueva();
  }

  /**
   * Menú de la fila: puntos de atención, editar, las acciones de workflow que correspondan al estado y desactivar. El
   * permiso lo vuelve a filtrar `app-row-actions` (y se recalcula en cada detección de cambios).
   */
  accionesDe(ficha: FichaLocalVM, accionesWorkflow: ResolverAccionesWorkflow): RowAction[] {
    const workflow = accionesWorkflow(ficha).map((accion): RowAction => ({
      label: ACCIONES_UI[accion].label,
      icon: ACCIONES_UI[accion].icon,
      danger: ACCIONES_UI[accion].danger,
      ariaLabel: `${ACCIONES_UI[accion].label}: ${nombreDeFicha(ficha)}`,
      run: () => this.onAccion(ficha, accion),
    }));

    const acciones: RowAction[] = [
      {
        // Los puntos de atención viven en el detalle de la ficha: el fragmento deja el foco en su panel.
        label: 'Puntos de atención',
        icon: 'map-pin',
        permission: 'READ_ATTENTION_POINT',
        ariaLabel: `Puntos de atención de la ficha ${nombreDeFicha(ficha)}`,
        run: () => this.router.navigate([RUTA_DETALLE_FICHA, ficha.id], { fragment: FRAGMENTO_PUNTOS }),
      },
      {
        label: 'Editar',
        icon: 'pencil-simple',
        permission: 'UPDATE_VARIANT',
        ariaLabel: `Editar la ficha ${nombreDeFicha(ficha)}`,
        run: () => this.router.navigate([RUTA_EDITAR_FICHA, ficha.id]),
      },
      ...workflow,
    ];
    if (ficha.activa) {
      acciones.push({
        label: 'Desactivar',
        icon: 'prohibit',
        permission: 'UPDATE_VARIANT',
        danger: true,
        ariaLabel: `Desactivar la ficha ${nombreDeFicha(ficha)}`,
        run: () => this.onDesactivar(ficha),
      });
    }
    return acciones;
  }

  onAccion(ficha: FichaLocalVM, accion: AccionWorkflow): void {
    this.confirmar(ficha, confirmAccion(ficha, accion, () => this.facade.ejecutar(ficha.id, accion)), ACCIONES_UI[accion].exito);
  }

  onDesactivar(ficha: FichaLocalVM): void {
    // La ficha desactivada sale de la lista (o, con "Mostrar desactivadas", pierde "Desactivar"): el foco va a la fila que ocupa su lugar.
    this.confirmar(ficha, confirmDesactivar(ficha, () => this.facade.desactivar(ficha.id)), 'Ficha desactivada', true);
  }

  /**
   * Confirma, ejecuta con la fila bloqueada y avisa. En una transición de workflow la fila no desaparece y el foco
   * vuelve solo a quien abrió el menú; `filaSale` lo lleva a la fila que queda en su lugar.
   */
  private confirmar(ficha: FichaLocalVM, confirmacion: ConfirmDialogData, exito: string, filaSale = false): void {
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion,
      aviso: textoExito(exito, this.fuenteSimulada),
      ocupado: this.lista.ocupar(ficha.id),
      ...(filaSale ? { foco: { host: this.host } } : {}),
    });
  }

  private textosVacio(
    hayFichas: boolean, hayFiltros: boolean, tab: Tab,
  ): VacioDeFichas {
    // Con filtros activos, "Sin resultados" aunque no haya fichas: el CTA es "Limpiar filtros".
    if (hayFiltros) {
      return {
        emptyTitle: 'Sin resultados', emptyMessage: 'Ninguna ficha coincide con la búsqueda o los filtros aplicados.',
        emptyAccion: 'limpiar', emptyActionLabel: 'Limpiar filtros', emptyActionIcon: 'x',
      };
    }
    if (hayFichas && tab === 'revision') {
      return {
        emptyTitle: 'No hay fichas en revisión',
        emptyMessage: 'Cuando alguien envíe una ficha a revisión, va a aparecer acá para publicarla.',
        emptyAccion: null, emptyActionLabel: '', emptyActionIcon: 'x',
      };
    }
    return {
      emptyTitle: 'Todavía no hay fichas por localidad',
      emptyMessage: 'Una ficha dice cómo se hace un trámite del organismo en una localidad, con sus requisitos, costos y puntos de atención.',
      emptyAccion: 'nueva', emptyActionLabel: 'Nueva ficha', emptyActionIcon: 'map-pin-plus',
    };
  }

  private comparar(a: FichaLocalVM, b: FichaLocalVM, key: string): number {
    switch (key) {
      case 'tramite': return compararTexto(a.plantillaTitulo ?? a.slug, b.plantillaTitulo ?? b.slug);
      case 'localidad': return compararTexto(a.localidadNombre, b.localidadNombre);
      case 'estado': return ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado];
      case 'version': return a.version - b.version;
      default: return 0;
    }
  }

  private filtrosActivos({ estado, localidadId, inactivas, localidades }: FiltrosDeFichas): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    if (estado) activos.push({ clave: 'estado', etiqueta: `Estado: ${ETIQUETA_ESTADO_PUBLICACION[estado]}` });
    if (localidadId) {
      const nombre = localidades.find((l) => l.id === localidadId)?.nombre ?? NO_DISPONIBLE;
      activos.push({ clave: 'localidad', etiqueta: `Localidad: ${nombre}` });
    }
    if (inactivas) activos.push({ clave: 'inactivas', etiqueta: 'Incluye desactivadas' });
    return activos;
  }
}

/** Localidades con nombre que usa al menos una ficha, sin repetir y ordenadas. */
function localidadesDeFiltro(fichas: FichaLocalVM[]): Opcion[] {
  const localidades = new Map<string, string>();
  for (const f of fichas) {
    if (f.localidadId && f.localidadNombre) localidades.set(f.localidadId, f.localidadNombre);
  }
  return [...localidades]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR', { sensitivity: 'base' }));
}
