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
import { DestinatariosFacade, DestinatarioVM } from '@features/destinatarios';
import { ListaCliente, compararPorTexto, textosDeVacio } from '@shared/utils/lista-cliente';
import { avisarExito } from '@shared/utils/avisos';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { DialogoEnLista } from '@shared/utils/dialogo-en-lista';
import { abrirFormDialog } from '@shared/utils/abrir-form-dialog';
import { dialogoDeDestinatario } from '../destinatario-dialogo';

@Component({
  selector: 'app-destinatarios-list',
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
  templateUrl: './destinatarios-list.component.html',
  styleUrl: './destinatarios-list.component.scss',
})
export class DestinatariosListComponent implements OnInit {
  private readonly facade = inject(DestinatariosFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Alta y edición van en diálogo sobre la lista; el diálogo guarda y acá solo se avisa. */
  private readonly dialogo = new DialogoEnLista<DestinatarioVM, DestinatarioVM>({
    abrir: (destinatario) => abrirFormDialog(this.dialog, dialogoDeDestinatario(this.facade, destinatario)),
    buscar: async (id) => (await firstValueFrom(this.facade.destinatarios$)).find((fila) => fila.id === id),
    alGuardar: (_guardada, destinatario) => avisarExito(this.snackBar, destinatario ? 'Destinatario actualizado' : 'Destinatario creado'),
    noEncontrada: 'No encontramos ese destinatario. Puede que lo hayan eliminado.',
  });

  /** Búsqueda, orden, paginado y estado de carga en cliente sobre `destinatarios$`. */
  readonly lista = new ListaCliente<DestinatarioVM>({
    fuente$: this.facade.destinatarios$,
    cargar: () => this.facade.loadDestinatarios(),
    buscarEn: (d) => [d.nombre],
    comparar: compararPorTexto((d, columna) => (columna === 'nombre' ? d.nombre : '')),
    extras: textosDeVacio(
      {
        emptyTitle: 'Todavía no hay destinatarios',
        emptyMessage: 'Creá el primero para poder indicar a quién está dirigido cada trámite.',
        emptyActionLabel: 'Nuevo destinatario',
      },
      {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ningún destinatario coincide con la búsqueda aplicada.',
        emptyActionLabel: 'Limpiar filtros',
      },
    ),
    alCargar: (lista) => this.dialogo.listaLista(lista),
  });

  /**
   * `DestinatarioVM` solo tiene id y nombre: no hay ningún campo real por el que filtrar,
   * así que la barra queda con el único chip "Todas" en vez de fabricar estados inexistentes.
   * El contador se calcula sobre lo ya buscado, para que no mienta.
   */
  readonly filterTabs$ = this.lista.buscadas$.pipe(map((buscadas) => todasOnlyTabs(buscadas.length)));

  readonly columns: TableColumn<DestinatarioVM>[] = [
    { key: 'nombre',   label: 'Nombre',   sortable: true },
    { key: 'acciones', label: 'Acciones', width: '140px' },
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

  accionEditar(destinatario: DestinatarioVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_RECIPIENT',
      ariaLabel: `Editar destinatario ${destinatario.nombre}`,
      run: () => this.onEdit(destinatario),
    };
  }

  accionesDe(destinatario: DestinatarioVM): RowAction[] {
    return [{
      label: 'Eliminar',
      icon: 'trash',
      permission: 'DELETE_RECIPIENT',
      danger: true,
      ariaLabel: `Eliminar destinatario ${destinatario.nombre}`,
      run: () => this.onDelete(destinatario),
    }];
  }

  onEdit(destinatario: DestinatarioVM): void {
    void this.dialogo.abrir(destinatario);
  }

  onDelete(destinatario: DestinatarioVM): void {
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: {
        title: '¿Eliminar el destinatario?',
        // Cuenta la consecuencia, no la restricción. Que no se pueda borrar un destinatario
        // en uso lo decide el backend y, si corresponde, vuelve como error.
        message: `Se eliminará ${destinatario.nombre} y dejará de estar disponible para clasificar trámites. Esta acción no se puede deshacer.`,
        highlight: destinatario.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando…',
        confirmAction: () => this.facade.delete(destinatario.id),
      },
      aviso: 'Destinatario eliminado',
      ocupado: this.lista.ocupar(destinatario.id),
      foco: { host: this.host },
    });
  }
}
