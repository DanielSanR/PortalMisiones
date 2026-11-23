import { Component, OnInit, ChangeDetectionStrategy, DestroyRef, ElementRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { firstValueFrom, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SharedTableComponent, TableCellDirective, TableColumn } from '@shared/components/table';
import { FilterTabsComponent } from '@shared/components/filter-tabs';
import { RowAction, RowActionsComponent } from '@shared/components/row-actions';
import { ListSearchComponent } from '@shared/components/list-search';
import { ListaPendienteComponent } from '@shared/components/lista-pendiente';
import { AtajoDirective } from '@shared/directives/atajo.directive';
import { ActiveFiltersComponent } from '@shared/components/active-filters';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { PageActionsDirective } from '@shared/directives/page-actions.directive';
import { todasOnlyTabs } from '@shared/utils/list-filter.utils';
import { EventosDeVidaFacade, EventoDeVidaVM } from '@features/eventos-de-vida';
import { ListaCliente, compararPorTexto, textosDeVacio } from '@shared/utils/lista-cliente';
import { avisarExito } from '@shared/utils/avisos';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { DialogoEnLista } from '@shared/utils/dialogo-en-lista';
import { abrirFormDialog } from '@shared/utils/abrir-form-dialog';
import { dialogoDeEventoDeVida } from '../evento-de-vida-dialogo';

@Component({
  selector: 'app-eventos-de-vida-list',
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
  templateUrl: './eventos-de-vida-list.component.html',
  styleUrl: './eventos-de-vida-list.component.scss',
})
export class EventosDeVidaListComponent implements OnInit {
  private readonly facade = inject(EventosDeVidaFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Alta y edición van en diálogo sobre la lista; el diálogo guarda y acá solo se avisa. */
  private readonly dialogo = new DialogoEnLista<EventoDeVidaVM, EventoDeVidaVM>({
    abrir: (evento) => abrirFormDialog(this.dialog, dialogoDeEventoDeVida(this.facade, evento)),
    buscar: async (id) => (await firstValueFrom(this.facade.eventos$)).find((fila) => fila.id === id),
    alGuardar: (_guardada, evento) => avisarExito(this.snackBar, evento ? 'Evento de vida actualizado' : 'Evento de vida creado'),
    noEncontrada: 'No encontramos ese evento de vida. Puede que lo hayan eliminado.',
  });

  /** Búsqueda, orden, paginado y estado de carga en cliente sobre `eventos$`. */
  readonly lista = new ListaCliente<EventoDeVidaVM>({
    fuente$: this.facade.eventos$,
    cargar: () => this.facade.loadEventos(),
    buscarEn: (e) => [e.nombre, e.slug],
    comparar: compararPorTexto((e, columna) => (columna === 'nombre' ? e.nombre : columna === 'slug' ? e.slug : '')),
    extras: textosDeVacio(
      {
        emptyTitle: 'Todavía no hay eventos de vida',
        emptyMessage: 'Creá el primero para agrupar los trámites por momento de la vida del ciudadano.',
        emptyActionLabel: 'Nuevo evento',
      },
      {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ningún evento de vida coincide con la búsqueda aplicada.',
        emptyActionLabel: 'Limpiar filtros',
      },
    ),
    alCargar: (lista) => this.dialogo.listaLista(lista),
  });

  /**
   * `EventoDeVidaVM` no tiene ningún campo con el que segmentar (solo id, slug y nombre):
   * un único chip "Todas" con el contador, sin fabricar filtros que no existen.
   * El contador se calcula sobre lo ya buscado, para que no mienta.
   */
  readonly filterTabs$ = this.lista.buscadas$.pipe(map((buscadas) => todasOnlyTabs(buscadas.length)));

  readonly columns: TableColumn<EventoDeVidaVM>[] = [
    { key: 'nombre',   label: 'Evento de Vida', sortable: true },
    { key: 'slug',     label: 'Slug',           sortable: true, hideOnMobile: true },
    { key: 'acciones', label: 'Acciones',       width: '140px' },
  ];

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

  accionEditar(evento: EventoDeVidaVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_LIFE_EVENT',
      ariaLabel: `Editar evento de vida ${evento.nombre}`,
      run: () => this.onEdit(evento),
    };
  }

  accionesDe(evento: EventoDeVidaVM): RowAction[] {
    return [{
      label: 'Eliminar',
      icon: 'trash',
      permission: 'DELETE_LIFE_EVENT',
      danger: true,
      ariaLabel: `Eliminar evento de vida ${evento.nombre}`,
      run: () => this.onDelete(evento),
    }];
  }

  onEdit(evento: EventoDeVidaVM): void {
    void this.dialogo.abrir(evento);
  }

  onDelete(evento: EventoDeVidaVM): void {
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: {
        title: '¿Eliminar el evento de vida?',
        // Cuenta la consecuencia. Si el backend rechaza el borrado por tener trámites
        // asociados, eso vuelve como error: adelantarlo acá sería inventar una regla.
        message: `Se eliminará ${evento.nombre} y dejará de estar disponible para agrupar trámites en el portal. Esta acción no se puede deshacer.`,
        highlight: evento.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando…',
        confirmAction: () => this.facade.delete(evento.id),
      },
      aviso: 'Evento de vida eliminado',
      ocupado: this.lista.ocupar(evento.id),
      foco: { host: this.host },
    });
  }
}
