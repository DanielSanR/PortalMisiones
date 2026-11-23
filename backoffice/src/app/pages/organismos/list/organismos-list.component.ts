import { Component, OnInit, ChangeDetectionStrategy, DestroyRef, ElementRef, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, map } from 'rxjs';
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
import { UnavailableDirective } from '@shared/directives/unavailable.directive';
import { PageActionsDirective } from '@shared/directives/page-actions.directive';
import { ActivoFiltro, activoFilterTabs, filterByActivo } from '@shared/utils/list-filter.utils';
import { OrganismosFacade, OrganismoVM } from '@features/organismos';
import { ListaCliente, compararPorTexto, textosDeVacio } from '@shared/utils/lista-cliente';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { tinteDeAvatar } from '@shared/utils/avatar-tinte';
import {
  PARAM_ORIGEN_EDICION, RUTA_DETALLE_ORGANISMO, RUTA_EDITAR_ORGANISMO, RUTA_NUEVO_ORGANISMO,
} from '../organismos.rutas';
import { errorDeEliminarOrganismo } from '../organismo-save-error';

@Component({
  selector: 'app-organismos-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    DatePipe,
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
    UnavailableDirective,
  ],
  templateUrl: './organismos-list.component.html',
  styleUrl: './organismos-list.component.scss',
})
export class OrganismosListComponent implements OnInit {
  private readonly facade = inject(OrganismosFacade);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Filtro "Todos/Activos/Inactivos" (campo real `activo`), client-side sobre el stream ya cargado. */
  readonly filtro$ = new BehaviorSubject<ActivoFiltro>('todos');

  /** Búsqueda, filtro por estado, orden, paginado y estado de carga en cliente sobre `organismos$`. */
  readonly lista = new ListaCliente<OrganismoVM, ActivoFiltro>({
    fuente$: this.facade.organismos$,
    cargar: () => this.facade.loadOrganismos(),
    buscarEn: (o) => [o.nombre, o.acronym, o.tipoNombre, o.parentNombre],
    comparar: compararPorTexto((organismo, columna) => {
      switch (columna) {
        case 'nombre':       return organismo.nombre;
        case 'parentNombre': return organismo.parentNombre;
        case 'tipoNombre':   return organismo.tipoNombre;
        case 'activo':       return organismo.activo ? 'Activo' : 'Inactivo';
        default:             return '';
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
        emptyTitle: 'Todavía no hay organismos',
        emptyMessage: 'Creá el primero para empezar a cargar sus trámites y responsables.',
        emptyActionLabel: 'Nuevo organismo',
      },
      {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ningún organismo coincide con la búsqueda o el filtro aplicado.',
        emptyActionLabel: 'Limpiar filtros',
      },
    ),
  });

  /** Los contadores de los chips se calculan sobre lo ya buscado, para que no mientan. */
  readonly filterTabs$ = this.lista.buscadas$.pipe(map(activoFilterTabs));

  readonly columns: TableColumn<OrganismoVM>[] = [
    { key: 'nombre',       label: 'Nombre',     sortable: true },
    { key: 'parentNombre', label: 'Depende de', sortable: true, hideOnMobile: true },
    { key: 'tipoNombre',   label: 'Tipo',       sortable: true, hideOnMobile: true },
    { key: 'activo',       label: 'Activo',     sortable: true, width: '110px' },
    { key: 'acciones',     label: 'Acciones',   width: '140px' },
  ];

  ngOnInit(): void {
    this.lista.cargar();
  }

  // NOTA: el diseño dibuja un chip "/" también en este buscador, pero esa tecla ya está
  // tomada por el buscador global del shell (admin-layout.component.ts:108) y una misma
  // tecla no puede enfocar dos inputs. Se omite acá para no mostrar un atajo que no
  // hace lo que promete; si se quiere uno propio hay que elegir otra tecla.

  /** El CTA del estado vacío crea o limpia según por qué está vacío. */
  onEmptyAction(): void {
    this.lista.accionDeVacio(() => this.onCreate());
  }

  /**
   * Iniciales del avatar: las dos primeras letras de la SIGLA.
   *
   * Es la regla del diseño, no las iniciales del nombre. "Secretaría de Estado de
   * Agricultura Familiar" (SAF) da "SA", que por nombre daría "SE". Cuando no hay
   * sigla se cae a las iniciales del nombre, salteando conectores para que
   * "Instituto de Previsión Social" no dé "ID".
   */
  iniciales(organismo: OrganismoVM): string {
    const letrasSigla = (organismo.acronym ?? '').replace(/[^\p{L}]/gu, '');
    if (letrasSigla.length >= 2) return letrasSigla.slice(0, 2).toLocaleUpperCase('es-AR');

    const conectores = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para']);
    const palabras = (organismo.nombre ?? '')
      .split(/\s+/)
      .filter((palabra) => /\p{L}/u.test(palabra) && !conectores.has(palabra.toLocaleLowerCase('es-AR')));

    if (palabras.length === 0) return '—';
    // Nombre de una sola palabra ("Vialidad"): dos letras se leen mejor que una.
    const letras = palabras.length === 1
      ? palabras[0].slice(0, 2)
      : palabras.slice(0, 2).map((palabra) => palabra[0]).join('');
    return letras.toLocaleUpperCase('es-AR');
  }

  /**
   * Tinte del avatar. Se deriva del id para que un mismo organismo conserve su color
   * entre recargas y ordenamientos, en vez de depender de la posición en la lista.
   */
  tinte(id: string): string {
    return tinteDeAvatar(id);
  }

  accionEditar(organismo: OrganismoVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_ORGANISM',
      ariaLabel: `Editar organismo ${organismo.nombre}`,
      run: () => this.onEdit(organismo),
    };
  }

  accionesDe(organismo: OrganismoVM): RowAction[] {
    return [
      {
        label: 'Ver detalle',
        icon: 'eye',
        permission: 'READ_ORGANISM',
        ariaLabel: `Ver detalle de ${organismo.nombre}`,
        run: () => this.onVerDetalle(organismo),
      },
      {
        label: 'Eliminar',
        icon: 'trash',
        permission: 'DELETE_ORGANISM',
        danger: true,
        ariaLabel: `Eliminar organismo ${organismo.nombre}`,
        run: () => this.onDelete(organismo),
      },
    ];
  }

  onCreate(): void {
    this.router.navigate([RUTA_NUEVO_ORGANISMO]);
  }

  onVerDetalle(organismo: OrganismoVM): void {
    this.router.navigate([RUTA_DETALLE_ORGANISMO, organismo.id]);
  }

  onEdit(organismo: OrganismoVM): void {
    this.router.navigate([RUTA_EDITAR_ORGANISMO, organismo.id], {
      queryParams: { [PARAM_ORIGEN_EDICION]: 'lista' },
    });
  }

  onDelete(organismo: OrganismoVM): void {
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: {
        title: '¿Eliminar el organismo?',
        // El diseño pide contar la consecuencia, no la restricción: qué pasa si sigo.
        // La regla de "no se puede si tiene hijos activos" la aplica el backend y, si
        // corresponde, vuelve como error; acá solo estorbaba.
        message: `Se eliminará ${organismo.nombre} y dejará de estar disponible para asociar trámites y usuarios. Esta acción no se puede deshacer.`,
        highlight: organismo.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando…',
        confirmAction: () => this.facade.delete(organismo.id),
        errorDeAccion: errorDeEliminarOrganismo,
      },
      aviso: 'Organismo eliminado',
      ocupado: this.lista.ocupar(organismo.id),
      foco: { host: this.host },
    });
  }
}
