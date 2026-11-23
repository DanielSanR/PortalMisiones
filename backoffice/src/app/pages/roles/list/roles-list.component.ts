import { Component, OnInit, ChangeDetectionStrategy, DestroyRef, ElementRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, forkJoin, map, shareReplay, tap } from 'rxjs';
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
import { PageActionsDirective } from '@shared/directives/page-actions.directive';
import { buildPermisoGroups, PermisoGroupVM } from '@shared/utils/permiso-groups.util';
import { UserRole } from '@core/enums/user-role.enum';
import { RolesFacade, RolVM } from '@features/roles';
import { PermisoVM } from '@features/permisos';
import { ESCRIBIR_ROLES_PERMISOS_ACCESS } from '@core/constants/policy-overrides.constants';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { ListaCliente, TextosDeVacio, VistaDeLista, textosDeVacio } from '@shared/utils/lista-cliente';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { RUTA_EDITAR_ROL, RUTA_NUEVO_ROL } from '../roles.rutas';
import { errorDeActivarRol } from '../role-save-error';

/** Filtro por alcance del rol (campo real `scopeTipo`). */
type ScopeFiltro = 'todos' | 'global' | 'organismo';

/** Vista de la pantalla: la de la lista más si quien mira puede escribir. */
type RolesVista = VistaDeLista<RolVM, ScopeFiltro> & TextosDeVacio & {
  /**
   * Quien mira puede crear/editar/eliminar (solo SUPERADMIN desde PPDT-5.1). ADMIN_BACKOFFICE ve la
   * pantalla en lectura: el backend le responde 403 a cualquier escritura.
   */
  puedeEscribir: boolean;
};

/** Panel de detalle: el rol seleccionado con su matriz de permisos ya resuelta. */
interface RolDetalle {
  rol: RolVM;
  groups: PermisoGroupVM[];
  protegido: boolean;
}

@Component({
  selector: 'app-roles-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HasPermissionDirective,
    AsyncPipe,
    MatButtonModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    FilterTabsComponent,
    RowActionsComponent,
    ListSearchComponent,
    ActiveFiltersComponent,
    PageActionsDirective,
    AtajoDirective,
    ListaPendienteComponent,
  ],
  templateUrl: './roles-list.component.html',
  styleUrl: './roles-list.component.scss',
})
export class RolesListComponent implements OnInit {
  private readonly facade = inject(RolesFacade);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly roles$ = this.facade.roles$;

  readonly filtro$ = new BehaviorSubject<ScopeFiltro>('todos');

  /** Catálogo completo de permisos: la matriz del detalle compara el rol contra él. */
  private readonly catalogo$ = new BehaviorSubject<PermisoVM[]>([]);
  /** Fila activa del master-detail. `.value` alimenta a `isRowSelected` (la tabla lo consulta sync). */
  private readonly seleccionId$ = new BehaviorSubject<string | null>(null);

  /**
   * Roles NO se gatea por permiso atómico sino por ROL (`/api/role`: leer SA/AB, escribir solo SA — PPDT-5.1).
   * El CTA del estado vacío gatea por permiso, que acá no aplica: lo resuelve el facade con la sesión, con la
   * misma regla que la ruta de edición (`ESCRIBIR_ROLES_PERMISOS_ACCESS`).
   */
  private readonly puedeEscribir$ = this.facade.puedeEscribir$;

  /** Regla de las acciones de fila y del botón "Nuevo rol" (`app-row-actions` / `*appHasPermission`). */
  readonly escribirRoles = ESCRIBIR_ROLES_PERMISOS_ACCESS;

  /**
   * Búsqueda, filtro por alcance, orden y estado de carga en cliente sobre `roles$` (la lista no pagina).
   * La carga trae roles + catálogo de permisos en paralelo: el detalle necesita los dos para dibujar la matriz.
   */
  readonly lista = new ListaCliente<RolVM, ScopeFiltro>({
    fuente$: this.roles$,
    cargar: () => forkJoin({ roles: this.facade.loadRoles(), formData: this.facade.getFormData(null) }).pipe(
      tap(({ formData }) => this.catalogo$.next(formData.permisos)),
    ),
    buscarEn: (r) => [r.codigo, r.descripcion, r.scopeTipo],
    comparar: (a, b, columna) => this.comparar(a, b, columna),
    filtros$: this.filtro$,
    filtrar: (buscados, filtro) => (filtro === 'todos' ? buscados : buscados.filter((r) => r.scopeTipo === filtro)),
    filtrosActivos: (filtro) => (filtro === 'todos'
      ? []
      : [{ clave: 'scope', etiqueta: `Alcance: ${filtro === 'global' ? 'Global' : 'Organismo'}` }]),
    limpiarFiltros: () => this.filtro$.next('todos'),
    extras: textosDeVacio(
      {
        emptyTitle: 'Todavía no hay roles',
        emptyMessage: 'Creá el primero para definir qué puede ver y hacer cada usuario del backoffice.',
        emptyActionLabel: 'Nuevo rol',
      },
      {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ningún rol coincide con la búsqueda o el filtro aplicado.',
        emptyActionLabel: 'Limpiar filtros',
      },
    ),
    tamanoDePagina: null,
  });

  /** Los contadores de los chips se calculan sobre lo ya buscado, para que no mientan. */
  readonly filterTabs$ = this.lista.buscadas$.pipe(map((buscados) => this.scopeTabs(buscados)));

  readonly vista$ = combineLatest([this.lista.vista$, this.puedeEscribir$]).pipe(
    map(([vista, puedeEscribir]): RolesVista => ({ ...vista, puedeEscribir })),
    // Dos consumidores (el template y la reconciliación de la selección): sin esto el
    // pipeline se recalcularía dos veces por emisión.
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly detalle$ = combineLatest([this.vista$, this.seleccionId$, this.catalogo$]).pipe(
    map(([vista, seleccionId, catalogo]): RolDetalle | null => {
      const rol = vista.rows.find((r) => r.id === seleccionId);
      if (!rol) return null;
      return {
        rol,
        groups: buildPermisoGroups(catalogo, new Set(rol.permisos.map((p) => p.id))),
        protegido: this.esRolProtegido(rol),
      };
    }),
  );

  // Divergencia: el diseño también muestra "Usuarios" por rol; `/api/role` no devuelve ese conteo, se omite.
  columns: TableColumn<RolVM>[] = [
    { key: 'rol',      label: 'Rol',      sortable: true },
    { key: 'permisos', label: 'Permisos', sortable: true, width: '110px', headerClass: 'cell-numeric', cellClass: 'cell-numeric' },
    { key: 'activo',   label: 'Activo',   sortable: true, width: '110px' },
    { key: 'acciones', label: 'Acciones', width: '150px' },
  ];

  /** La tabla la consulta durante el render: tiene que ser sincrónica y estable. */
  readonly isRowSelected = (rol: RolVM): boolean => this.seleccionId$.value === rol.id;

  /**
   * ¿Es el rol SUPERADMIN? Hecho estructural del rol (no de quién mira): el tag "Protegido" y la nota
   * del detalle se ven siempre.
   */
  esRolProtegido(rol: RolVM): boolean {
    return rol.codigo.toUpperCase() === UserRole.SUPERADMIN;
  }

  ngOnInit(): void {
    // La selección se reconcilia con lo visible: al filtrar, borrar o recargar, el panel de
    // detalle no puede quedar mostrando un rol que ya no está en la lista.
    this.vista$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((vista) => {
        if (vista.rows.some((rol) => rol.id === this.seleccionId$.value)) return;
        this.seleccionId$.next(vista.rows[0]?.id ?? null);
      });

    this.lista.cargar();
  }

  seleccionar(rol: RolVM): void {
    this.seleccionId$.next(rol.id);
  }

  /** El CTA del estado vacío crea o limpia según por qué está vacío. */
  onEmptyAction(): void {
    this.lista.accionDeVacio(() => this.onCreate());
  }

  onCreate(): void {
    this.router.navigate([RUTA_NUEVO_ROL]);
  }

  onEdit(rol: RolVM): void {
    this.router.navigate([RUTA_EDITAR_ROL, rol.id]);
  }

  /** Editar y eliminar: solo SUPERADMIN (PPDT-5.1). Para el resto, `app-row-actions` las oculta. */
  accionEditar(rol: RolVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      rule: ESCRIBIR_ROLES_PERMISOS_ACCESS,
      ariaLabel: `Editar rol ${rol.codigo}`,
      run: () => this.onEdit(rol),
    };
  }

  /**
   * El backend no borra roles: los desactiva. Un rol inactivo ofrece "Activar" (el mismo `PUT` que "Editar"
   * con el interruptor prendido). Las dos son escritura: solo SUPERADMIN (PPDT-5.1).
   */
  accionesDe(rol: RolVM): RowAction[] {
    if (!rol.activo) {
      return [{
        label: 'Activar',
        icon: 'check-circle',
        rule: ESCRIBIR_ROLES_PERMISOS_ACCESS,
        ariaLabel: `Activar rol ${rol.codigo}`,
        run: () => this.onActivate(rol),
      }];
    }
    return [{
      label: 'Desactivar',
      icon: 'prohibit',
      danger: true,
      rule: ESCRIBIR_ROLES_PERMISOS_ACCESS,
      ariaLabel: `Desactivar rol ${rol.codigo}`,
      run: () => this.onDelete(rol),
    }];
  }

  onDelete(rol: RolVM): void {
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: {
        title: '¿Desactivar el rol?',
        // Cuenta la consecuencia, no la restricción: si no se puede desactivar un rol con usuarios
        // asignados lo decide el backend y, si corresponde, vuelve como error.
        message: `${rol.codigo} quedará inactivo y quienes lo tengan asignado perderán esos permisos. Podés volver a activarlo desde esta lista.`,
        highlight: rol.codigo,
        danger: true,
        confirmText: 'Sí, desactivar',
        busyText: 'Desactivando…',
        confirmAction: () => this.facade.delete(rol.id),
      },
      aviso: 'Rol desactivado',
      ocupado: this.lista.ocupar(rol.id),
      // La fila queda, pero se vuelve a dibujar (el botón que abrió el menú ya no existe): el foco va a la fila.
      foco: { host: this.host },
    });
  }

  onActivate(rol: RolVM): void {
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: {
        title: '¿Activar el rol?',
        message: `${rol.codigo} volverá a estar activo y quienes lo tengan asignado recuperarán sus permisos.`,
        highlight: rol.codigo,
        danger: false,
        confirmText: 'Sí, activar',
        busyText: 'Activando…',
        // Solo el id: el facade pide el rol fresco antes del PUT (que reemplaza todos sus datos), así no pisa
        // cambios que otro administrador haya hecho mientras la lista estaba abierta.
        confirmAction: () => this.facade.activate(rol.id),
        errorDeAccion: errorDeActivarRol,
      },
      aviso: 'Rol activado',
      ocupado: this.lista.ocupar(rol.id),
      // Igual que al desactivar: la fila queda pero se vuelve a dibujar, así que el foco va a ella.
      foco: { host: this.host },
    });
  }

  private scopeTabs(roles: RolVM[]): FilterTabOption[] {
    return [
      { value: 'todos',     label: 'Todos',     count: roles.length },
      { value: 'global',    label: 'Global',    count: roles.filter((r) => r.scopeTipo === 'global').length },
      { value: 'organismo', label: 'Organismo', count: roles.filter((r) => r.scopeTipo === 'organismo').length },
    ];
  }

  private comparar(a: RolVM, b: RolVM, key: string): number {
    switch (key) {
      case 'permisos': return a.permisos.length - b.permisos.length;
      case 'activo':   return Number(a.activo) - Number(b.activo);
      // La columna "Rol" muestra código + descripción; el código es lo que la identifica.
      default:         return a.codigo.localeCompare(b.codigo, 'es-AR', { sensitivity: 'base' });
    }
  }
}
