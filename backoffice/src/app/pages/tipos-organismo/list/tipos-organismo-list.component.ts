import { Component, OnInit, ChangeDetectionStrategy, DestroyRef, ElementRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { BehaviorSubject, firstValueFrom, map } from 'rxjs';
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
import { ActivoFiltro, activoFilterTabs, filterByActivo } from '@shared/utils/list-filter.utils';
import { TiposOrganismoFacade, TipoOrganismoVM } from '@features/tipos-organismo';
import { ListaCliente, compararPorTexto, textosDeVacio } from '@shared/utils/lista-cliente';
import { avisarExito } from '@shared/utils/avisos';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { DialogoEnLista } from '@shared/utils/dialogo-en-lista';
import { abrirFormDialog } from '@shared/utils/abrir-form-dialog';
import { dialogoDeTipoOrganismo, errorDeEliminarTipo } from '../tipo-organismo-dialogo';

@Component({
  selector: 'app-tipos-organismo-list',
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
  templateUrl: './tipos-organismo-list.component.html',
  styleUrl: './tipos-organismo-list.component.scss',
})
export class TiposOrganismoListComponent implements OnInit {
  private readonly facade = inject(TiposOrganismoFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Filtro "Todos/Activos/Inactivos" (campo real `activo`), client-side sobre el stream ya cargado. */
  readonly filtro$ = new BehaviorSubject<ActivoFiltro>('todos');

  /** Alta y edición van en diálogo sobre la lista; el diálogo guarda y acá solo se avisa. */
  private readonly dialogo = new DialogoEnLista<TipoOrganismoVM, TipoOrganismoVM>({
    abrir: (tipo) => abrirFormDialog(this.dialog, dialogoDeTipoOrganismo(this.facade, tipo)),
    buscar: async (id) => (await firstValueFrom(this.facade.tipos$)).find((fila) => fila.id === id),
    alGuardar: (_guardada, tipo) => avisarExito(this.snackBar, tipo ? 'Tipo de organismo actualizado' : 'Tipo de organismo creado'),
    noEncontrada: 'No encontramos ese tipo de organismo. Puede que lo hayan eliminado.',
  });

  /** Búsqueda, filtro por estado, orden, paginado y estado de carga en cliente sobre `tipos$`. */
  readonly lista = new ListaCliente<TipoOrganismoVM, ActivoFiltro>({
    fuente$: this.facade.tipos$,
    cargar: () => this.facade.loadTipos(),
    buscarEn: (t) => [t.nombre, t.descripcion, t.code],
    comparar: compararPorTexto((tipo, columna) => {
      switch (columna) {
        case 'nombre':      return tipo.nombre;
        case 'descripcion': return tipo.descripcion;
        case 'activo':      return tipo.activo ? 'Activo' : 'Inactivo';
        default:            return '';
      }
    }),
    filtros$: this.filtro$,
    filtrar: filterByActivo,
    filtrosActivos: (filtro) => (filtro === 'todos'
      ? []
      : [{ clave: 'estado', etiqueta: `Estado: ${filtro === 'activos' ? 'Activos' : 'Inactivos'}` }]),
    limpiarFiltros: () => this.filtro$.next('todos'),
    extras: textosDeVacio(
      {
        emptyTitle: 'Todavía no hay tipos de organismo',
        emptyMessage: 'Creá el primero para poder clasificar los organismos de la provincia.',
        emptyActionLabel: 'Nuevo tipo',
      },
      {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ningún tipo de organismo coincide con la búsqueda o el filtro aplicado.',
        emptyActionLabel: 'Limpiar filtros',
      },
    ),
    alCargar: (lista) => this.dialogo.listaLista(lista),
  });

  /** Los contadores de los chips se calculan sobre lo ya buscado, para que no mientan. */
  readonly filterTabs$ = this.lista.buscadas$.pipe(map(activoFilterTabs));

  readonly columns: TableColumn<TipoOrganismoVM>[] = [
    { key: 'nombre',      label: 'Nombre',      sortable: true },
    { key: 'descripcion', label: 'Descripción', sortable: true, hideOnMobile: true },
    { key: 'activo',      label: 'Activo',      sortable: true, width: '110px' },
    { key: 'acciones',    label: 'Acciones',    width: '140px' },
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

  accionEditar(tipo: TipoOrganismoVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_ORGANISM_TYPE',
      ariaLabel: `Editar tipo de organismo ${tipo.nombre}`,
      run: () => this.onEdit(tipo),
    };
  }

  accionesDe(tipo: TipoOrganismoVM): RowAction[] {
    return [{
      label: 'Eliminar',
      icon: 'trash',
      permission: 'DELETE_ORGANISM_TYPE',
      danger: true,
      ariaLabel: `Eliminar tipo de organismo ${tipo.nombre}`,
      run: () => this.onDelete(tipo),
    }];
  }

  onEdit(tipo: TipoOrganismoVM): void {
    void this.dialogo.abrir(tipo);
  }

  onDelete(tipo: TipoOrganismoVM): void {
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: {
        title: '¿Eliminar el tipo de organismo?',
        // Cuenta la consecuencia, no la restricción. Que no se pueda borrar un tipo con
        // organismos activos lo decide el backend y, si corresponde, vuelve como error:
        // adelantarlo acá solo agregaba ruido y mezclaba eliminar con desactivar.
        message: `Se eliminará ${tipo.nombre} y dejará de estar disponible para clasificar organismos. Esta acción no se puede deshacer.`,
        highlight: tipo.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando…',
        confirmAction: () => this.facade.delete(tipo.id),
        errorDeAccion: errorDeEliminarTipo,
      },
      aviso: 'Tipo de organismo eliminado',
      ocupado: this.lista.ocupar(tipo.id),
      foco: { host: this.host },
    });
  }
}
