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
import { ModalidadesFacade, ModalidadVM } from '@features/modalidades';
import { ListaCliente, compararPorTexto, textosDeVacio } from '@shared/utils/lista-cliente';
import { avisarExito } from '@shared/utils/avisos';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { DialogoEnLista } from '@shared/utils/dialogo-en-lista';
import { abrirFormDialog } from '@shared/utils/abrir-form-dialog';
import { dialogoDeModalidad } from '../modalidad-dialogo';

@Component({
  selector: 'app-modalidades-list',
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
  templateUrl: './modalidades-list.component.html',
  styleUrl: './modalidades-list.component.scss',
})
export class ModalidadesListComponent implements OnInit {
  private readonly facade = inject(ModalidadesFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Alta y edición van en diálogo sobre la lista; el diálogo guarda y acá solo se avisa. */
  private readonly dialogo = new DialogoEnLista<ModalidadVM, ModalidadVM>({
    abrir: (modalidad) => abrirFormDialog(this.dialog, dialogoDeModalidad(this.facade, modalidad)),
    buscar: async (id) => (await firstValueFrom(this.facade.modalidades$)).find((fila) => fila.id === id),
    alGuardar: (_guardada, modalidad) => avisarExito(this.snackBar, modalidad ? 'Modalidad actualizada' : 'Modalidad creada'),
    noEncontrada: 'No encontramos esa modalidad. Puede que la hayan eliminado.',
  });

  /** Búsqueda, orden, paginado y estado de carga en cliente sobre `modalidades$`. */
  readonly lista = new ListaCliente<ModalidadVM>({
    fuente$: this.facade.modalidades$,
    cargar: () => this.facade.loadModalidades(),
    buscarEn: (m) => [m.nombre],
    comparar: compararPorTexto((m, columna) => (columna === 'nombre' ? m.nombre : '')),
    extras: textosDeVacio(
      {
        emptyTitle: 'Todavía no hay modalidades',
        emptyMessage: 'Creá la primera para indicar de qué forma se puede realizar cada trámite.',
        emptyActionLabel: 'Nueva modalidad',
      },
      {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ninguna modalidad coincide con la búsqueda.',
        emptyActionLabel: 'Limpiar búsqueda',
      },
    ),
    alCargar: (lista) => this.dialogo.listaLista(lista),
  });

  /**
   * Chip único "Todas": el `activo` del VM es un soft-delete que el backend nunca devuelve
   * en false, así que un filtro Activas/Inactivas contaría siempre cero y mentiría.
   * El contador se calcula sobre lo ya buscado, igual que en el resto de las listas.
   */
  readonly filterTabs$ = this.lista.buscadas$.pipe(map((buscadas) => todasOnlyTabs(buscadas.length)));

  readonly columns: TableColumn<ModalidadVM>[] = [
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

  accionEditar(modalidad: ModalidadVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_MODALITY',
      ariaLabel: `Editar modalidad ${modalidad.nombre}`,
      run: () => this.onEdit(modalidad),
    };
  }

  accionesDe(modalidad: ModalidadVM): RowAction[] {
    return [{
      label: 'Eliminar',
      icon: 'trash',
      permission: 'DELETE_MODALITY',
      danger: true,
      ariaLabel: `Eliminar modalidad ${modalidad.nombre}`,
      run: () => this.onDelete(modalidad),
    }];
  }

  onEdit(modalidad: ModalidadVM): void {
    void this.dialogo.abrir(modalidad);
  }

  onDelete(modalidad: ModalidadVM): void {
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: {
        title: '¿Eliminar la modalidad?',
        // Cuenta la consecuencia, no la restricción: si el backend rechaza borrar una
        // modalidad en uso, eso vuelve como error del propio pedido.
        message: `Se eliminará ${modalidad.nombre} y dejará de estar disponible para clasificar trámites. Esta acción no se puede deshacer.`,
        highlight: modalidad.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando…',
        confirmAction: () => this.facade.delete(modalidad.id),
      },
      aviso: 'Modalidad eliminada',
      ocupado: this.lista.ocupar(modalidad.id),
      foco: { host: this.host },
    });
  }
}
