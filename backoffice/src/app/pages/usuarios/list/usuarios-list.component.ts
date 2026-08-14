import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, Observable, combineLatest, debounceTime, distinctUntilChanged, filter, finalize, map, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SharedTableComponent, TableCellDirective, TableColumn, TablePageEvent, TableSortEvent } from '../../../shared/components/table';
import { FilterTabsComponent } from '../../../shared/components/filter-tabs';
import { RowAction, RowActionsComponent } from '../../../shared/components/row-actions';
import { ListSearchComponent } from '../../../shared/components/list-search';
import { ActiveFiltersComponent, FiltroActivo } from '../../../shared/components/active-filters';
import { RolLabelPipe } from '../../../shared/pipes/rol-label.pipe';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { ActivoFiltro, activoFilterTabs, buscarEn, filterByActivo } from '@core/utils/list-filter.utils';
import { ROLE_TO_SPANISH } from '@core/enums/user-role.enum';
import { UsuariosFacade, UsuarioVM } from '@features/usuarios';

/** Textos del estado vacío: distinguen "todavía no hay nada" de "los filtros no matchean". */
interface EstadoVacio {
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
}

/** ViewModel de la pantalla: filas ya buscadas/filtradas/ordenadas + los textos que corresponden. */
interface UsuariosVista extends EstadoVacio {
  /** Solo la página visible. */
  rows: UsuarioVM[];
  /** Total tras filtrar (lo que cuenta el toolbar y alimenta al paginador). */
  total: number;
  pageIndex: number;
  hayFiltros: boolean;
  filtrosActivos: FiltroActivo[];
}

/** Paleta de tintes de los avatares de la tabla (Kitchen Sink §05). */
const TINTES = ['blue', 'warm', 'green', 'grey'] as const;

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    FilterTabsComponent,
    RowActionsComponent,
    ListSearchComponent,
    ActiveFiltersComponent,
    RolLabelPipe,
    HasPermissionDirective,
    PageActionsDirective,
  ],
  templateUrl: './usuarios-list.component.html',
  styleUrl: './usuarios-list.component.scss',
})
export class UsuariosListComponent implements OnInit {
  private readonly facade = inject(UsuariosFacade);
  readonly usuarios$ = this.facade.usuarios$;

  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  /** Id del usuario con un cambio de estado en vuelo, para bloquear su fila mientras dura. */
  trabajandoId: string | null = null;

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  /** Filtro "Todos/Activos/Inactivos" (campo real `activo` = cuenta habilitada), client-side. */
  readonly filtro$ = new BehaviorSubject<ActivoFiltro>('todos');
  readonly sort$ = new BehaviorSubject<TableSortEvent | null>(null);

  private readonly search$ = this.searchCtrl.valueChanges.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    startWith(this.searchCtrl.value),
  );

  /** Los contadores de los chips se calculan sobre lo ya buscado, para que no mientan. */
  readonly filterTabs$ = combineLatest([this.usuarios$, this.search$]).pipe(
    map(([usuarios, search]) => activoFilterTabs(this.buscar(usuarios, search))),
  );

  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);

  readonly vista$ = combineLatest([
    this.usuarios$, this.filtro$, this.search$, this.sort$, this.pageIndex$, this.pageSize$,
  ]).pipe(
    map(([usuarios, filtro, search, sort, pageIndex, pageSize]): UsuariosVista => {
      const filtrados = this.ordenar(filterByActivo(this.buscar(usuarios, search), filtro), sort);
      // Al filtrar, la página actual puede quedar fuera de rango: se acota en vez de
      // mostrar una tabla vacía con resultados que sí existen.
      const ultimaPagina = Math.max(0, Math.ceil(filtrados.length / pageSize) - 1);
      const pagina = Math.min(pageIndex, ultimaPagina);
      const desde = pagina * pageSize;

      const filtrosActivos = this.filtrosActivos(search, filtro);
      const hayFiltros = filtrosActivos.length > 0;
      return {
        rows: filtrados.slice(desde, desde + pageSize),
        total: filtrados.length,
        pageIndex: pagina,
        hayFiltros,
        filtrosActivos,
        ...this.estadoVacio(usuarios.length, hayFiltros),
      };
    }),
  );

  columns: TableColumn<UsuarioVM>[] = [
    { key: 'nombre',          label: 'Usuario',   sortable: true },
    { key: 'email',           label: 'Email',     sortable: true, hideOnMobile: true },
    { key: 'rol',             label: 'Rol',       sortable: true, width: '160px' },
    { key: 'organismoNombre', label: 'Organismo', sortable: true, hideOnMobile: true },
    { key: 'activo',          label: 'Cuenta',    sortable: true, width: '120px' },
    { key: 'acciones',        label: 'Acciones',  width: '140px' },
  ];

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.facade.loadUsuarios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        // Antes la carga era un `try/finally` sin `catch`: el error se perdía como
        // rechazo no manejado y la lista afirmaba "no hay usuarios" cuando en
        // realidad la API no había respondido.
        error: () => { this.loading = false; this.error = true; this.cdr.markForCheck(); },
      });
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

  onPageChange(evento: TablePageEvent): void {
    this.pageIndex$.next(evento.pageIndex);
    this.pageSize$.next(evento.pageSize);
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/usuarios/nuevo']);
  }

  onEdit(usuario: UsuarioVM): void {
    this.router.navigate(['/dashboard/usuarios/editar', usuario.id]);
  }

  /** Nombre y apellido del perfil; el backend real todavía puede no traerlos, y ahí manda el email. */
  nombreCompleto(usuario: UsuarioVM): string {
    return `${usuario.nombre ?? ''} ${usuario.apellido ?? ''}`.trim() || usuario.email;
  }

  iniciales(usuario: UsuarioVM): string {
    const partes = [usuario.nombre, usuario.apellido]
      .map((parte) => (parte ?? '').trim())
      .filter((parte) => /\p{L}/u.test(parte));

    // Sin perfil cargado el avatar se arma con el email, que siempre existe.
    if (partes.length === 0) {
      const letras = (usuario.email ?? '').replace(/[^\p{L}]/gu, '');
      return letras.slice(0, 2).toLocaleUpperCase('es-AR') || '—';
    }
    const letras = partes.length === 1 ? partes[0].slice(0, 2) : partes.map((parte) => parte[0]).join('');
    return letras.toLocaleUpperCase('es-AR');
  }

  /** Tinte estable por id: el mismo usuario conserva su color entre cargas. */
  tinte(id: string): string {
    let acumulado = 0;
    for (const caracter of id ?? '') acumulado = (acumulado + caracter.charCodeAt(0)) % 997;
    return TINTES[acumulado % TINTES.length];
  }

  accionEditar(usuario: UsuarioVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_USER',
      run: () => this.onEdit(usuario),
    };
  }

  /**
   * Desactivar es lo más destructivo que ofrece el backend hoy: no hay endpoint de borrado
   * de usuarios, así que no se muestra "Eliminar" para no prometer algo que no existe.
   */
  accionesDe(usuario: UsuarioVM): RowAction[] {
    return [
      usuario.activo
        ? {
            label: 'Desactivar cuenta',
            icon: 'prohibit',
            permission: 'UPDATE_USER',
            danger: true,
            ariaLabel: `Desactivar la cuenta de ${this.nombreCompleto(usuario)}`,
            run: () => this.onDesactivar(usuario),
          }
        : {
            label: 'Activar cuenta',
            icon: 'check-circle',
            permission: 'UPDATE_USER',
            ariaLabel: `Activar la cuenta de ${this.nombreCompleto(usuario)}`,
            run: () => this.onActivar(usuario),
          },
    ];
  }

  onDesactivar(usuario: UsuarioVM): void {
    this.confirmarYEjecutar(usuario, {
      title: '¿Desactivar la cuenta?',
      // Cuenta la consecuencia real: pierde el acceso, pero el usuario no se borra.
      message: `${this.nombreCompleto(usuario)} dejará de poder ingresar al backoffice. La cuenta se conserva y podés volver a activarla cuando quieras.`,
      danger: true,
      confirmText: 'Sí, desactivar',
      busyText: 'Desactivando...',
      exito: 'Cuenta desactivada',
    });
  }

  onActivar(usuario: UsuarioVM): void {
    this.confirmarYEjecutar(usuario, {
      title: '¿Activar la cuenta?',
      message: `${this.nombreCompleto(usuario)} volverá a poder ingresar al backoffice con los permisos de su rol.`,
      danger: false,
      confirmText: 'Sí, activar',
      busyText: 'Activando...',
      exito: 'Cuenta activada',
    });
  }

  private confirmarYEjecutar(usuario: UsuarioVM, opciones: {
    title: string; message: string; danger: boolean; confirmText: string; busyText: string; exito: string;
  }): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: opciones.title,
        message: opciones.message,
        highlight: this.nombreCompleto(usuario),
        danger: opciones.danger,
        confirmText: opciones.confirmText,
        busyText: opciones.busyText,
        // El diálogo se queda abierto con el botón en spinner hasta que el backend
        // responde, en vez de cerrar optimistamente y dejar al usuario sin señal.
        confirmAction: () => this.cambiarEstado(usuario),
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open(opciones.exito, 'OK', {
        duration: 3000,
        // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
        panelClass: 'snackbar-success',
      }));
  }

  /**
   * `toggleActive` y no `setAccountStatus` porque es el único que devuelve el usuario
   * actualizado y lo refleja en el stream de la lista: con el otro la fila seguiría
   * mostrando el estado viejo hasta recargar.
   */
  private cambiarEstado(usuario: UsuarioVM): Observable<unknown> {
    this.trabajandoId = usuario.id;
    this.cdr.markForCheck();
    return this.facade.toggleActive(usuario.id).pipe(
      finalize(() => { this.trabajandoId = null; this.cdr.markForCheck(); }),
    );
  }

  private buscar(usuarios: UsuarioVM[], termino: string): UsuarioVM[] {
    return buscarEn(usuarios, termino, (u) => [
      u.nombre, u.apellido, `${u.nombre} ${u.apellido}`, u.email, u.organismoNombre, ROLE_TO_SPANISH[u.rol],
    ]);
  }

  private ordenar(usuarios: UsuarioVM[], sort: TableSortEvent | null): UsuarioVM[] {
    if (!sort?.direction) return usuarios;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...usuarios].sort((a, b) =>
      this.valorDeOrden(a, sort.active)
        .localeCompare(this.valorDeOrden(b, sort.active), 'es-AR', { sensitivity: 'base' }) * factor,
    );
  }

  private valorDeOrden(usuario: UsuarioVM, key: string): string {
    switch (key) {
      case 'nombre':          return this.nombreCompleto(usuario);
      case 'email':           return usuario.email ?? '';
      case 'rol':             return ROLE_TO_SPANISH[usuario.rol] ?? usuario.rol ?? '';
      case 'organismoNombre': return usuario.organismoNombre ?? '';
      case 'activo':          return usuario.activo ? 'Activa' : 'Inactiva';
      default:                return '';
    }
  }

  private filtrosActivos(search: string, filtro: ActivoFiltro): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    const termino = search.trim();
    if (termino) activos.push({ clave: 'search', etiqueta: `Búsqueda: ${termino}` });
    if (filtro !== 'todos') {
      activos.push({ clave: 'estado', etiqueta: `Cuenta: ${filtro === 'activos' ? 'Activas' : 'Inactivas'}` });
    }
    return activos;
  }

  private estadoVacio(total: number, hayFiltros: boolean): EstadoVacio {
    if (total > 0 && hayFiltros) {
      return {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ningún usuario coincide con la búsqueda o el filtro aplicado.',
        emptyActionLabel: 'Limpiar filtros',
      };
    }
    return {
      emptyTitle: 'Todavía no hay usuarios',
      emptyMessage: 'Creá el primero para dar acceso al backoffice y asignarle un rol.',
      emptyActionLabel: 'Nuevo usuario',
    };
  }
}
