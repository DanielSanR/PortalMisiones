import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, filter, finalize, forkJoin,
  map, shareReplay, startWith,
} from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SharedTableComponent, TableCellDirective, TableColumn, TableSortEvent } from '../../../shared/components/table';
import { FilterTabsComponent, FilterTabOption } from '../../../shared/components/filter-tabs';
import { RowAction, RowActionsComponent } from '../../../shared/components/row-actions';
import { ListSearchComponent } from '../../../shared/components/list-search';
import { ActiveFiltersComponent, FiltroActivo } from '../../../shared/components/active-filters';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { buscarEn } from '@core/utils/list-filter.utils';
import { buildPermisoGroups, PermisoGroupVM } from '@core/utils/permiso-groups.util';
import { AuthTokenService } from '@core/services/auth-token.service';
import { UserRole } from '@core/enums/user-role.enum';
import { RolesFacade, RolVM } from '@features/roles';
import { PermisoVM } from '@features/permisos';

/** Filtro por alcance del rol (campo real `scopeTipo`). */
type ScopeFiltro = 'todos' | 'global' | 'organismo';

/** Textos del estado vacío: distinguen "todavía no hay nada" de "los filtros no matchean". */
interface EstadoVacio {
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
}

/** ViewModel de la pantalla: filas ya buscadas/filtradas/ordenadas + los textos que corresponden. */
interface RolesVista extends EstadoVacio {
  rows: RolVM[];
  /** Total tras filtrar (lo que cuenta el toolbar). */
  total: number;
  hayFiltros: boolean;
  filtrosActivos: FiltroActivo[];
  /**
   * Quien mira la pantalla es SUPERADMIN. Solo él puede tocar el rol SUPERADMIN: el backend
   * corta con 403 `4029` (§4.4), así que la fila lo refleja en vez de ofrecer una acción que falla.
   */
  puedeGestionarProtegidos: boolean;
}

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
    AsyncPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    FilterTabsComponent,
    RowActionsComponent,
    ListSearchComponent,
    ActiveFiltersComponent,
    PageActionsDirective,
  ],
  templateUrl: './roles-list.component.html',
  styleUrl: './roles-list.component.scss',
})
export class RolesListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  /**
   * Excepción consciente a "el componente solo inyecta su facade": Roles NO se gatea por permiso
   * atómico sino por ROL (`/api/role` = hasAnyRole SUPERADMIN/ADMIN_BACKOFFICE, §4.4), igual que su
   * ruta (`pages.module.ts`, `requireRoles: SUPER_AB`). `app-row-actions` y el CTA del estado vacío
   * gatean por permiso, que acá no aplica, así que la única regla por fila —proteger el rol
   * SUPERADMIN— se resuelve con la sesión actual, de forma reactiva.
   */
  private readonly auth = inject(AuthTokenService);

  readonly roles$ = this.facade.roles$;

  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  /** Id del rol con un borrado en vuelo, para bloquear su fila mientras dura. */
  deletingId: string | null = null;

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  readonly filtro$ = new BehaviorSubject<ScopeFiltro>('todos');
  readonly sort$ = new BehaviorSubject<TableSortEvent | null>(null);

  /** Catálogo completo de permisos: la matriz del detalle compara el rol contra él. */
  private readonly catalogo$ = new BehaviorSubject<PermisoVM[]>([]);
  /** Fila activa del master-detail. `.value` alimenta a `isRowSelected` (la tabla lo consulta sync). */
  private readonly seleccionId$ = new BehaviorSubject<string | null>(null);

  private readonly search$ = this.searchCtrl.valueChanges.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    startWith(this.searchCtrl.value),
  );

  private readonly esSuperAdmin$ = this.auth.getCurrentUser$().pipe(
    // `role` es el rol principal; `roles` trae el resto en sesiones multi-rol.
    map((user) => user?.role === UserRole.SUPERADMIN || (user?.roles ?? []).includes(UserRole.SUPERADMIN)),
  );

  /** Los contadores de los chips se calculan sobre lo ya buscado, para que no mientan. */
  readonly filterTabs$ = combineLatest([this.roles$, this.search$]).pipe(
    map(([roles, search]) => this.scopeTabs(this.buscar(roles, search))),
  );

  readonly vista$ = combineLatest([
    this.roles$, this.filtro$, this.search$, this.sort$, this.esSuperAdmin$,
  ]).pipe(
    map(([roles, filtro, search, sort, esSuperAdmin]): RolesVista => {
      const buscados = this.buscar(roles, search);
      const rows = this.ordenar(filtro === 'todos' ? buscados : buscados.filter((r) => r.scopeTipo === filtro), sort);
      const filtrosActivos = this.filtrosActivos(search, filtro);
      const hayFiltros = filtrosActivos.length > 0;
      return {
        rows,
        total: rows.length,
        hayFiltros,
        filtrosActivos,
        puedeGestionarProtegidos: esSuperAdmin,
        ...this.estadoVacio(roles.length, hayFiltros),
      };
    }),
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

  columns: TableColumn<RolVM>[] = [
    { key: 'rol',      label: 'Rol',      sortable: true },
    { key: 'permisos', label: 'Permisos', sortable: true, width: '110px' },
    { key: 'activo',   label: 'Activo',   sortable: true, width: '110px' },
    { key: 'acciones', label: 'Acciones', width: '150px' },
  ];

  /** La tabla la consulta durante el render: tiene que ser sincrónica y estable. */
  readonly isRowSelected = (rol: RolVM): boolean => this.seleccionId$.value === rol.id;

  /**
   * ¿Es el rol SUPERADMIN? A diferencia de `puedeGestionarProtegidos` (que depende de QUIÉN mira la
   * pantalla), esto es un hecho estructural del rol: el tag "Protegido" y la nota del detalle se ven
   * siempre, sea cual sea el usuario logueado.
   */
  esRolProtegido(rol: RolVM): boolean {
    return rol.codigo.toUpperCase() === UserRole.SUPERADMIN;
  }

  constructor(
    private facade: RolesFacade,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    // La selección se reconcilia con lo visible: al filtrar, borrar o recargar, el panel de
    // detalle no puede quedar mostrando un rol que ya no está en la lista.
    this.vista$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((vista) => {
        if (vista.rows.some((rol) => rol.id === this.seleccionId$.value)) return;
        this.seleccionId$.next(vista.rows[0]?.id ?? null);
      });

    this.load();
  }

  /**
   * Roles + catálogo de permisos en paralelo: el detalle necesita los dos para dibujar la matriz.
   * Antes era `Promise.all` dentro de un `try/finally` sin `catch`, así que un fallo de la API
   * quedaba como unhandled rejection y la pantalla afirmaba "no hay roles".
   */
  load(): void {
    this.loading = true;
    this.error = false;
    forkJoin({ roles: this.facade.loadRoles(), formData: this.facade.getFormData(null) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ formData }) => {
          this.catalogo$.next(formData.permisos);
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.error = true;
          this.cdr.markForCheck();
        },
      });
  }

  seleccionar(rol: RolVM): void {
    this.seleccionId$.next(rol.id);
  }

  limpiarFiltros(): void {
    this.searchCtrl.setValue('');
    this.filtro$.next('todos');
  }

  /** Quita un solo filtro desde su chip en la barra "Filtros activos". */
  quitarFiltro(clave: string): void {
    if (clave === 'search') this.searchCtrl.setValue('');
    else this.filtro$.next('todos');
  }

  hayFiltrosActivos(): boolean {
    return this.filtro$.value !== 'todos' || this.searchCtrl.value.trim().length > 0;
  }

  /** El CTA del estado vacío crea o limpia según por qué está vacío. */
  onEmptyAction(): void {
    if (this.hayFiltrosActivos()) {
      this.limpiarFiltros();
      return;
    }
    this.onCreate();
  }

  onSortChange(sort: TableSortEvent): void {
    this.sort$.next(sort);
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/roles/nuevo']);
  }

  onEdit(rol: RolVM): void {
    this.router.navigate(['/dashboard/roles/editar', rol.id]);
  }

  /**
   * Las acciones no llevan `permission`: acá el permiso lo da el ROL y ya lo verificó la ruta
   * (`requireRoles: SUPER_AB`). Lo único que se restringe por fila es el rol SUPERADMIN.
   */
  accionEditar(rol: RolVM, puedeGestionarProtegidos: boolean): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      disabled: !this.puedeModificar(rol, puedeGestionarProtegidos),
      ariaLabel: `Editar rol ${rol.codigo}`,
      run: () => this.onEdit(rol),
    };
  }

  accionesDe(rol: RolVM, puedeGestionarProtegidos: boolean): RowAction[] {
    return [{
      label: 'Eliminar',
      icon: 'trash',
      danger: true,
      disabled: !this.puedeModificar(rol, puedeGestionarProtegidos),
      ariaLabel: `Eliminar rol ${rol.codigo}`,
      run: () => this.onDelete(rol),
    }];
  }

  /** Motivo por el que la fila está bloqueada; vacío si no lo está (el tooltip no se dibuja). */
  motivoBloqueo(rol: RolVM, puedeGestionarProtegidos: boolean): string {
    return this.puedeModificar(rol, puedeGestionarProtegidos)
      ? ''
      : 'Solo un SUPERADMIN puede editar o eliminar el rol SUPERADMIN';
  }

  onDelete(rol: RolVM): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '¿Eliminar el rol?',
        // Cuenta la consecuencia, no la restricción: que no se pueda borrar un rol con usuarios
        // asignados lo decide el backend y, si corresponde, vuelve como error.
        message: `Se eliminará ${rol.codigo} y quienes lo tengan asignado perderán esos permisos. Esta acción no se puede deshacer.`,
        highlight: rol.codigo,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando...',
        // El diálogo se queda abierto con el botón en spinner hasta que el backend responde, en
        // vez de cerrar optimistamente y dejar al usuario sin señal de qué pasó.
        confirmAction: () => {
          this.deletingId = rol.id;
          this.cdr.markForCheck();
          return this.facade.delete(rol.id).pipe(
            finalize(() => { this.deletingId = null; this.cdr.markForCheck(); }),
          );
        },
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open('Rol eliminado', 'OK', {
        duration: 3000,
        // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
        panelClass: 'snackbar-success',
      }));
  }

  private puedeModificar(rol: RolVM, puedeGestionarProtegidos: boolean): boolean {
    return puedeGestionarProtegidos || !this.esRolProtegido(rol);
  }

  private buscar(roles: RolVM[], termino: string): RolVM[] {
    return buscarEn(roles, termino, (r) => [r.codigo, r.descripcion, r.scopeTipo]);
  }

  private scopeTabs(roles: RolVM[]): FilterTabOption[] {
    return [
      { value: 'todos',     label: 'Todos',     count: roles.length },
      { value: 'global',    label: 'Global',    count: roles.filter((r) => r.scopeTipo === 'global').length },
      { value: 'organismo', label: 'Organismo', count: roles.filter((r) => r.scopeTipo === 'organismo').length },
    ];
  }

  private ordenar(roles: RolVM[], sort: TableSortEvent | null): RolVM[] {
    if (!sort?.direction) return roles;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...roles].sort((a, b) => this.comparar(a, b, sort.active) * factor);
  }

  private comparar(a: RolVM, b: RolVM, key: string): number {
    switch (key) {
      case 'permisos': return a.permisos.length - b.permisos.length;
      case 'activo':   return Number(a.activo) - Number(b.activo);
      // La columna "Rol" muestra código + descripción; el código es lo que la identifica.
      default:         return a.codigo.localeCompare(b.codigo, 'es-AR', { sensitivity: 'base' });
    }
  }

  private filtrosActivos(search: string, filtro: ScopeFiltro): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    const termino = search.trim();
    if (termino) activos.push({ clave: 'search', etiqueta: `Búsqueda: ${termino}` });
    if (filtro !== 'todos') {
      activos.push({ clave: 'scope', etiqueta: `Alcance: ${filtro === 'global' ? 'Global' : 'Organismo'}` });
    }
    return activos;
  }

  private estadoVacio(total: number, hayFiltros: boolean): EstadoVacio {
    if (total > 0 && hayFiltros) {
      return {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ningún rol coincide con la búsqueda o el filtro aplicado.',
        emptyActionLabel: 'Limpiar filtros',
      };
    }
    return {
      emptyTitle: 'Todavía no hay roles',
      emptyMessage: 'Creá el primero para definir qué puede ver y hacer cada usuario del backoffice.',
      emptyActionLabel: 'Nuevo rol',
    };
  }
}
