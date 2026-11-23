import { Component, OnInit, ChangeDetectionStrategy, DestroyRef, ElementRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { BehaviorSubject, combineLatest, filter, firstValueFrom, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SharedTableComponent, TableCellDirective, TableColumn } from '@shared/components/table';
import { FilterTabsComponent, FilterTabOption } from '@shared/components/filter-tabs';
import { RowAction, RowActionsComponent } from '@shared/components/row-actions';
import { ListSearchComponent } from '@shared/components/list-search';
import { ListaPendienteComponent } from '@shared/components/lista-pendiente';
import { AtajoDirective } from '@shared/directives/atajo.directive';
import { ActiveFiltersComponent } from '@shared/components/active-filters';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { PageActionsDirective } from '@shared/directives/page-actions.directive';
import { EtiquetasFacade, EtiquetaVM } from '@features/etiquetas';
import { CREAR_ETIQUETA_ACCESS } from '@core/constants/policy-overrides.constants';
import { ListaCliente, TextosDeVacio, compararPorTexto, textosDeVacio } from '@shared/utils/lista-cliente';
import { avisarExito } from '@shared/utils/avisos';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { DialogoEnLista } from '@shared/utils/dialogo-en-lista';
import { abrirFormDialog } from '@shared/utils/abrir-form-dialog';
import { dialogoDeEtiqueta } from '../etiqueta-dialogo';

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

/** Lo que filtra la lista: el alcance elegido y si la sesión solo ve etiquetas locales. */
interface FiltrosDeEtiquetas {
  alcance: AlcanceFiltro;
  soloLocales: boolean;
}

/** Textos del vacío + si se ofrece el filtro por alcance. */
interface ExtrasDeEtiquetas extends TextosDeVacio {
  /**
   * Se ofrece el filtro "Todas / Globales / Locales". No para una sesión con organismo: solo ve las
   * etiquetas locales del suyo, así que los tres chips darían siempre lo mismo (o cero).
   */
  filtraPorAlcance: boolean;
}

const TEXTOS_DE_VACIO = textosDeVacio(
  {
    emptyTitle: 'Todavía no hay etiquetas',
    emptyMessage: 'Creá la primera para poder etiquetar los trámites del portal.',
    emptyActionLabel: 'Nueva etiqueta',
  },
  {
    emptyTitle: 'Sin resultados',
    emptyMessage: 'Ninguna etiqueta coincide con la búsqueda o el filtro aplicado.',
    emptyActionLabel: 'Limpiar filtros',
  },
);

@Component({
  selector: 'app-etiquetas-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    FilterTabsComponent,
    RowActionsComponent,
    ListSearchComponent,
    ListaPendienteComponent,
    ActiveFiltersComponent,
    HasPermissionDirective,
    PageActionsDirective,
    AtajoDirective,
  ],
  templateUrl: './etiquetas-list.component.html',
  styleUrl: './etiquetas-list.component.scss',
})
export class EtiquetasListComponent implements OnInit {
  private readonly facade = inject(EtiquetasFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** "Nueva etiqueta" (botón y CTA del vacío): solo quien puede elegir un alcance válido (BO-20). */
  readonly crearAccess = CREAR_ETIQUETA_ACCESS;

  /**
   * Filtro "Todas/Globales/Locales" (campo real `local`), client-side sobre el stream ya cargado. Solo se
   * ofrece y se aplica si la sesión ve etiquetas de más de un alcance (`filtraPorAlcance`).
   */
  readonly filtro$ = new BehaviorSubject<AlcanceFiltro>('todas');

  /** Alta y edición van en diálogo sobre la lista; el diálogo guarda y acá solo se avisa. */
  private readonly dialogo = new DialogoEnLista<EtiquetaVM, EtiquetaVM>({
    abrir: (etiqueta) => abrirFormDialog(this.dialog, dialogoDeEtiqueta(this.facade, etiqueta)),
    buscar: async (id) => (await firstValueFrom(this.facade.etiquetas$)).find((fila) => fila.id === id),
    alGuardar: (_guardada, etiqueta) => avisarExito(this.snackBar, etiqueta ? 'Etiqueta actualizada' : 'Etiqueta creada'),
    noEncontrada: 'No encontramos esa etiqueta. Puede que la hayan eliminado.',
  });

  /** Búsqueda, filtro por alcance, orden, paginado y estado de carga en cliente sobre `etiquetas$`. */
  readonly lista = new ListaCliente<EtiquetaVM, FiltrosDeEtiquetas, ExtrasDeEtiquetas>({
    fuente$: this.facade.etiquetas$,
    cargar: () => this.facade.loadEtiquetas(),
    buscarEn: (e) => [e.slug, e.organismoNombre],
    // Por organismo, las globales (sin organismo) quedan juntas en un extremo en vez de mezclarse.
    comparar: compararPorTexto((etiqueta, columna) =>
      (columna === 'slug' ? etiqueta.slug : columna === 'organismo' ? etiqueta.organismoNombre : '')),
    filtros$: combineLatest([this.filtro$, this.facade.soloEtiquetasLocales$]).pipe(
      map(([alcance, soloLocales]): FiltrosDeEtiquetas => ({ alcance, soloLocales })),
    ),
    filtrar: (buscadas, filtros) => filtrarPorAlcance(buscadas, filtros.alcance),
    filtrosActivos: ({ alcance }) => (alcance === 'todas'
      ? []
      : [{ clave: 'alcance', etiqueta: `Alcance: ${ALCANCE_LABELS[alcance]}` }]),
    limpiarFiltros: () => this.filtro$.next('todas'),
    extras: (contexto) => ({ ...TEXTOS_DE_VACIO(contexto), filtraPorAlcance: !contexto.filtros.soloLocales }),
    alCargar: (lista) => this.dialogo.listaLista(lista),
  });

  /** Los contadores de los chips se calculan sobre lo ya buscado, para que no mientan. */
  readonly filterTabs$ = this.lista.buscadas$.pipe(map(alcanceTabs));

  readonly columns: TableColumn<EtiquetaVM>[] = [
    { key: 'slug',          label: 'Etiqueta',  sortable: true },
    { key: 'organismo',     label: 'Organismo', sortable: true, hideOnMobile: true },
    { key: 'acciones',      label: 'Acciones',  width: '140px' },
  ];

  constructor() {
    // Sin el filtro a la vista tampoco puede quedar aplicado: uno elegido antes (la sesión cambió con la
    // pantalla abierta) dejaría la lista filtrada sin ningún control para deshacerlo.
    this.facade.soloEtiquetasLocales$
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.filtro$.next('todas'));
  }

  ngOnInit(): void {
    this.lista.cargar();
  }

  /** El CTA del estado vacío crea o limpia según por qué está vacío. */
  onEmptyAction(): void {
    this.lista.accionDeVacio(() => this.onCreate());
  }

  onCreate(): void {
    void this.dialogo.abrir(null);
  }

  accionEditar(etiqueta: EtiquetaVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_TAG',
      ariaLabel: `Editar etiqueta ${etiqueta.slug}`,
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
    void this.dialogo.abrir(etiqueta);
  }

  onDelete(etiqueta: EtiquetaVM): void {
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: {
        title: '¿Eliminar la etiqueta?',
        message: `Se eliminará la etiqueta ${etiqueta.slug} y dejará de estar disponible para clasificar trámites. Esta acción no se puede deshacer.`,
        highlight: etiqueta.slug,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando…',
        confirmAction: () => this.facade.delete(etiqueta.id),
      },
      aviso: 'Etiqueta eliminada',
      ocupado: this.lista.ocupar(etiqueta.id),
      foco: { host: this.host },
    });
  }
}
