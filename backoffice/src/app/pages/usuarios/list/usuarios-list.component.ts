import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, ElementRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, Observable, combineLatest, debounceTime, distinctUntilChanged, filter, finalize, firstValueFrom, map, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { abrirConfirmacion } from '../../../shared/utils/abrir-confirmacion';
import { SharedTableComponent, TableCellDirective, TableColumn, TablePageEvent, TableSortEvent } from '../../../shared/components/table';
import { FilterTabsComponent } from '../../../shared/components/filter-tabs';
import { RowAction, RowActionsComponent } from '../../../shared/components/row-actions';
import { ListSearchComponent } from '../../../shared/components/list-search';
import { AtajoDirective } from '../../../shared/directives/atajo.directive';
import { ActiveFiltersComponent, FiltroActivo } from '../../../shared/components/active-filters';
import { RolLabelPipe } from '../../../shared/pipes/rol-label.pipe';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { UnavailableDirective } from '../../../shared/directives/unavailable.directive';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { ActivoFiltro, activoFilterTabs, buscarEn, filterByActivo } from '@core/utils/list-filter.utils';
import { ROLE_TO_SPANISH, UserRole } from '@core/enums/user-role.enum';
import { EDITAR_USUARIO_ACCESS } from '@core/constants/policy-overrides.constants';
import { SesionUsuariosVM, UsuariosFacade, UsuarioVM } from '@features/usuarios';
import { enfocarTrasEliminar, indiceDeFilaActiva } from '@shared/utils/foco-lista';
import { tinteDeAvatar } from '@shared/utils/avatar-tinte';
import { DialogoEnLista } from '@shared/utils/dialogo-en-lista';
import { abrirFormDialog } from '@shared/utils/abrir-form-dialog';
import { UsuarioGuardado, dialogoDeUsuario } from '../usuario-dialogo';
import { CredencialModo, dialogoDeCredencial } from '../usuario-credencial-dialogo';
import { errorDeAccionDeCuenta } from '../usuario-accion-error';

/**
 * Roles cuya contraseña el backend no deja cambiar desde el panel (403 `4029` en
 * `PUT /api/user/{id}/change-password`): la acción no se ofrece en esas filas, cuando el rol se conoce.
 *
 * Desde el backend `586b670` (PPDT-5.1) un Administrador de Backoffice tampoco puede eliminar,
 * activar/desactivar ni cambiarles el email (mismo 403 `4029`). Como `GET /api/user` no trae el rol, esas
 * acciones no se pueden ocultar de antemano: se ofrecen y, si el backend las rechaza, el diálogo de cada
 * una cuenta el motivo con texto propio (`usuario-accion-error.ts`).
 */
const ROLES_CON_PASSWORD_PROTEGIDA: readonly UserRole[] = [UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE];

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
    AtajoDirective,
    UnavailableDirective,
  ],
  templateUrl: './usuarios-list.component.html',
  styleUrl: './usuarios-list.component.scss',
})
export class UsuariosListComponent implements OnInit {
  private readonly facade = inject(UsuariosFacade);
  readonly usuarios$ = this.facade.usuarios$;
  /** Quién opera la pantalla (la publica el facade): reconoce "mi cuenta" y decide qué ofrece el alta. */
  private sesion: SesionUsuariosVM | null = null;
  /** Hay un diálogo de credencial abriéndose o abierto: no se abre otro encima. */
  private abriendoCredencial = false;

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
        ...this.estadoVacio(hayFiltros),
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Alta y edición van en diálogo sobre la lista; el diálogo guarda y acá solo se avisa y se refresca. */
  private readonly dialogo = new DialogoEnLista<UsuarioVM, UsuarioGuardado>({
    abrir: async (usuario) => {
      const { esSuperAdmin } = await firstValueFrom(this.facade.sesion$);
      return abrirFormDialog(this.dialog, dialogoDeUsuario(this.facade, usuario?.id ?? null, { esSuperAdmin }));
    },
    buscar: async (id) => (await firstValueFrom(this.usuarios$)).find((fila) => fila.id === id),
    alGuardar: (guardado, usuario) => {
      this.refrescar();
      if (usuario) {
        this.avisarExito('Usuario actualizado');
      } else if (guardado.desactivacionFallida) {
        // El alta ya ocurrió pero la cuenta quedó activa: más tiempo en pantalla y variante de advertencia.
        this.snackBar.open('Usuario creado, pero no se pudo desactivar la cuenta. Desactivala desde la lista.', 'OK', {
          duration: 10000,
          panelClass: 'snackbar-warning',
        });
      } else {
        this.avisarExito('Usuario creado');
      }
    },
    noEncontrada: 'No encontramos ese usuario. Puede que lo hayan eliminado.',
  });

  ngOnInit(): void {
    // Emite en el acto (la sesión es un BehaviorSubject), así que está lista antes del primer render.
    this.facade.sesion$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sesion) => { this.sesion = sesion; this.cdr.markForCheck(); });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.dialogo.listaLista(false);
    this.facade.loadUsuarios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); this.dialogo.listaLista(true); },
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
    void this.dialogo.abrir(null);
  }

  onEdit(usuario: UsuarioVM): void {
    void this.dialogo.abrir(usuario);
  }

  /** Vuelve a pedir la lista sin el estado de carga: el alta suma una fila que el stream todavía no tiene. */
  private refrescar(): void {
    this.facade.loadUsuarios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  private avisarExito(mensaje: string): void {
    // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
    this.snackBar.open(mensaje, 'OK', { duration: 3000, panelClass: 'snackbar-success' });
  }

  /** Nombre y apellido del perfil; sin ellos (el backend real todavía no los trae) los textos de diálogos y menús usan el email. */
  nombreCompleto(usuario: UsuarioVM): string {
    return this.tieneNombre(usuario) ? `${usuario.nombre ?? ''} ${usuario.apellido ?? ''}`.trim() : usuario.email;
  }

  /** ¿El perfil trae nombre o apellido? Si no, la columna Usuario muestra "Sin dato". */
  tieneNombre(usuario: UsuarioVM): boolean {
    return `${usuario.nombre ?? ''}${usuario.apellido ?? ''}`.trim().length > 0;
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
    return tinteDeAvatar(id);
  }

  accionEditar(usuario: UsuarioVM): RowAction {
    const disponible = this.facade.edicionDisponible;
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      rule: EDITAR_USUARIO_ACCESS,
      // Visible pero no disponible (con motivo) mientras el backend no tenga edición de usuarios.
      disabled: !disponible,
      disabledReason: disponible ? undefined : 'La edición de nombre, rol y organismo todavía no está disponible en el servidor',
      ariaLabel: `Editar a ${this.nombreCompleto(usuario)}`,
      run: () => this.onEdit(usuario),
    };
  }

  /**
   * Menú de la fila. El orden va de lo cotidiano a lo irreversible: credenciales, estado de la
   * cuenta y, al final, el borrado definitivo (el componente agrupa las `danger` detrás de un divisor).
   * Credenciales, estado de la cuenta y borrado solo si la fuente los soporta (`accionesDeCuentaDisponibles`,
   * `borradoDefinitivoDisponible`): si no, se ocultan en vez de simular un éxito que no ocurrió en el servidor.
   */
  accionesDe(usuario: UsuarioVM): RowAction[] {
    const nombre = this.nombreCompleto(usuario);
    const deCuenta = this.facade.accionesDeCuentaDisponibles;
    const acciones: RowAction[] = [];

    if (deCuenta) {
      acciones.push({
        label: 'Cambiar email',
        icon: 'envelope-simple',
        permission: 'UPDATE_USER',
        ariaLabel: `Cambiar el email de ${nombre}`,
        run: () => this.abrirCredencial(usuario, 'email'),
      });
    }

    // Rol desconocido (el backend todavía no lo informa, G-13): se ofrece; si es uno protegido,
    // el diálogo muestra el 403 del backend.
    if (deCuenta && !(usuario.rol && ROLES_CON_PASSWORD_PROTEGIDA.includes(usuario.rol))) {
      acciones.push({
        label: 'Cambiar contraseña',
        icon: 'key',
        permission: 'UPDATE_USER',
        ariaLabel: `Cambiar la contraseña de ${nombre}`,
        run: () => this.abrirCredencial(usuario, 'password'),
      });
    }

    // Sobre la propia cuenta no se ofrece quitarse el acceso ni borrarse: no hay vuelta atrás
    // desde el panel y dejaría la sesión actual sin usuario.
    if (this.esMiCuenta(usuario)) return acciones;

    if (!deCuenta) return acciones;

    acciones.push(
      usuario.activo
        ? {
            label: 'Desactivar cuenta',
            icon: 'prohibit',
            permission: 'UPDATE_USER',
            danger: true,
            ariaLabel: `Desactivar la cuenta de ${nombre}`,
            run: () => this.onDesactivar(usuario),
          }
        : {
            label: 'Activar cuenta',
            icon: 'check-circle',
            permission: 'UPDATE_USER',
            ariaLabel: `Activar la cuenta de ${nombre}`,
            run: () => this.onActivar(usuario),
          },
    );
    if (!this.facade.borradoDefinitivoDisponible) return acciones;
    acciones.push({
      label: 'Eliminar definitivamente',
      icon: 'trash',
      permission: 'DELETE_USER',
      danger: true,
      ariaLabel: `Eliminar definitivamente a ${nombre}`,
      run: () => this.onEliminar(usuario),
    });
    return acciones;
  }

  /**
   * ¿Es la fila del usuario logueado? Por id, o por email si los ids no coinciden (con el listado
   * mock). Se lee en cada detección de cambios, así que acompaña a la sesión.
   */
  private esMiCuenta(usuario: UsuarioVM): boolean {
    const yo = this.sesion;
    if (!yo?.usuarioId) return false;
    return usuario.id === yo.usuarioId || (!!yo.email && usuario.email?.toLowerCase() === yo.email.toLowerCase());
  }

  private async abrirCredencial(usuario: UsuarioVM, modo: CredencialModo): Promise<void> {
    // El diálogo se carga en diferido: un segundo clic mientras llega no abre otro.
    if (this.abriendoCredencial) return;
    this.abriendoCredencial = true;
    const data = dialogoDeCredencial({
      modo,
      nombre: this.nombreCompleto(usuario),
      emailActual: usuario.email,
      operador: this.sesion?.rol ?? null,
      guardar: (valor) => modo === 'email'
        ? this.facade.changeEmail(usuario.id, valor)
        : this.facade.changePassword(usuario.id, valor),
    });
    let guardado: unknown;
    try {
      const ref = await abrirFormDialog(this.dialog, data);
      guardado = await firstValueFrom(ref.afterClosed(), { defaultValue: undefined });
    } catch {
      // No llegó el código del diálogo (sin conexión): se avisa en vez de fallar en silencio.
      this.snackBar.open('No pudimos abrir el formulario. Revisá tu conexión e intentá de nuevo.', 'OK', {
        duration: 5000, panelClass: 'snackbar-error',
      });
      return;
    } finally {
      this.abriendoCredencial = false;
    }
    if (!guardado) return;
    this.snackBar.open(
      modo === 'email' ? 'Email actualizado' : 'Contraseña actualizada',
      'OK',
      { duration: 3000, panelClass: 'snackbar-success' },
    );
  }

  onEliminar(usuario: UsuarioVM): void {
    // Foco tras borrar: la fila (y su botón) desaparece; se captura la posición antes de abrir el diálogo.
    const indice = indiceDeFilaActiva(this.host);
    const nombre = this.nombreCompleto(usuario);
    abrirConfirmacion(this.dialog, {
      data: {
        title: '¿Eliminar el usuario definitivamente?',
        // Distinto de desactivar: acá no hay vuelta atrás, y conviene ofrecer la alternativa.
        message: `Se borrará ${nombre} con todos sus datos y no se puede deshacer. Si solo querés quitarle el acceso, desactivá la cuenta.`,
        highlight: nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando…',
        confirmAction: () => this.conFilaOcupada(usuario, this.facade.deleteDefinitive(usuario.id)),
        errorDeAccion: (err) => errorDeAccionDeCuenta(err, 'eliminar', this.sesion?.rol ?? null),
      },
      panelClass: 'custom-modal-panel',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        enfocarTrasEliminar(this.host, indice, this.destroyRef);
        this.snackBar.open('Usuario eliminado', 'OK', {
          duration: 3000,
          panelClass: 'snackbar-success',
        });
      });
  }

  onDesactivar(usuario: UsuarioVM): void {
    this.confirmarYEjecutar(usuario, false, {
      title: '¿Desactivar la cuenta?',
      // Cuenta la consecuencia real: pierde el acceso, pero el usuario no se borra.
      message: `${this.nombreCompleto(usuario)} dejará de poder ingresar al backoffice. La cuenta se conserva y podés volver a activarla cuando quieras.`,
      danger: true,
      confirmText: 'Sí, desactivar',
      busyText: 'Desactivando…',
      exito: 'Cuenta desactivada',
    });
  }

  onActivar(usuario: UsuarioVM): void {
    this.confirmarYEjecutar(usuario, true, {
      title: '¿Activar la cuenta?',
      message: `${this.nombreCompleto(usuario)} volverá a poder ingresar al backoffice con los permisos de su rol.`,
      danger: false,
      confirmText: 'Sí, activar',
      busyText: 'Activando…',
      exito: 'Cuenta activada',
    });
  }

  private confirmarYEjecutar(usuario: UsuarioVM, activo: boolean, opciones: {
    title: string; message: string; danger: boolean; confirmText: string; busyText: string; exito: string;
  }): void {
    abrirConfirmacion(this.dialog, {
      data: {
        title: opciones.title,
        message: opciones.message,
        highlight: this.nombreCompleto(usuario),
        danger: opciones.danger,
        confirmText: opciones.confirmText,
        busyText: opciones.busyText,
        // El diálogo se queda abierto con el botón en spinner hasta que el backend
        // responde, en vez de cerrar optimistamente y dejar al usuario sin señal.
        confirmAction: () => this.cambiarEstado(usuario, activo),
        // 403 `4029` (cuenta privilegiada o fuera de alcance): texto propio, no el `message` del backend.
        errorDeAccion: (err) => errorDeAccionDeCuenta(err, activo ? 'activar' : 'desactivar', this.sesion?.rol ?? null),
      },
      panelClass: 'custom-modal-panel',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open(opciones.exito, 'OK', {
        duration: 3000,
        // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
        panelClass: 'snackbar-success',
      }));
  }

  /** Estado explícito (el que confirmó el usuario), nunca un toggle: ver `UsuariosFacade.setAccountStatus`. */
  private cambiarEstado(usuario: UsuarioVM, activo: boolean): Observable<unknown> {
    return this.conFilaOcupada(usuario, this.facade.setAccountStatus(usuario.id, activo));
  }

  /** Bloquea la fila mientras corre la operación y la libera al terminar (éxito o error). */
  private conFilaOcupada<T>(usuario: UsuarioVM, operacion$: Observable<T>): Observable<T> {
    this.trabajandoId = usuario.id;
    this.cdr.markForCheck();
    return operacion$.pipe(
      finalize(() => { this.trabajandoId = null; this.cdr.markForCheck(); }),
    );
  }

  private buscar(usuarios: UsuarioVM[], termino: string): UsuarioVM[] {
    return buscarEn(usuarios, termino, (u) => [
      u.nombre, u.apellido, `${u.nombre} ${u.apellido}`, u.email, u.organismoNombre, u.rol ? ROLE_TO_SPANISH[u.rol] : '',
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
      case 'rol':             return usuario.rol ? ROLE_TO_SPANISH[usuario.rol] ?? usuario.rol : '';
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

  private estadoVacio(hayFiltros: boolean): EstadoVacio {
    // Con filtros activos el CTA siempre limpia (aunque el dataset esté vacío): "Nuevo…" solo sin filtros.
    if (hayFiltros) {
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
