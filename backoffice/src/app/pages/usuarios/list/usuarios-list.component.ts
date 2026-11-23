import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, ElementRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { BehaviorSubject, firstValueFrom, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { RolLabelPipe } from '@shared/pipes/rol-label.pipe';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { PageActionsDirective } from '@shared/directives/page-actions.directive';
import { ActivoFiltro, activoFilterTabs, filterByActivo } from '@shared/utils/list-filter.utils';
import { ROLE_TO_SPANISH } from '@core/enums/user-role.enum';
import { EDITAR_USUARIO_ACCESS } from '@core/constants/policy-overrides.constants';
import { SesionUsuariosVM, UsuariosFacade, UsuarioVM } from '@features/usuarios';
import { ListaCliente, compararPorTexto, textosDeVacio } from '@shared/utils/lista-cliente';
import { avisarAdvertencia, avisarError, avisarExito } from '@shared/utils/avisos';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { tinteDeAvatar } from '@shared/utils/avatar-tinte';
import { DialogoEnLista } from '@shared/utils/dialogo-en-lista';
import { abrirFormDialog } from '@shared/utils/abrir-form-dialog';
import { UsuarioGuardado, dialogoDeUsuario } from '../usuario-dialogo';
import { CredencialModo, dialogoDeCredencial } from '../usuario-credencial-dialogo';
import { errorDeAccionDeCuenta } from '../usuario-accion-error';
import { confirmacionDeEstado, mensajeDeEliminar, ofreceCambioDePassword } from './usuario-acciones';

@Component({
  selector: 'app-usuarios-list',
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
    ActiveFiltersComponent,
    RolLabelPipe,
    HasPermissionDirective,
    PageActionsDirective,
    AtajoDirective,
    ListaPendienteComponent,
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

  /** Filtro "Todos/Activos/Inactivos" (campo real `activo` = cuenta habilitada), client-side. */
  readonly filtro$ = new BehaviorSubject<ActivoFiltro>('todos');

  /** Búsqueda, filtro por estado de la cuenta, orden, paginado y estado de carga en cliente sobre `usuarios$`. */
  readonly lista = new ListaCliente<UsuarioVM, ActivoFiltro>({
    fuente$: this.usuarios$,
    cargar: () => this.facade.loadUsuarios(),
    buscarEn: (u) => [
      u.nombre, u.apellido, `${u.nombre} ${u.apellido}`, u.email, u.organismoNombre, u.rol ? ROLE_TO_SPANISH[u.rol] : '',
    ],
    comparar: compararPorTexto((usuario, columna) => this.valorDeOrden(usuario, columna)),
    filtros$: this.filtro$,
    filtrar: filterByActivo,
    filtrosActivos: (filtro) => (filtro === 'todos'
      ? []
      : [{ clave: 'estado', etiqueta: `Cuenta: ${filtro === 'activos' ? 'Activas' : 'Inactivas'}` }]),
    limpiarFiltros: () => this.filtro$.next('todos'),
    extras: textosDeVacio(
      {
        emptyTitle: 'Todavía no hay usuarios',
        emptyMessage: 'Creá el primero para dar acceso al backoffice y asignarle un rol.',
        emptyActionLabel: 'Nuevo usuario',
      },
      {
        emptyTitle: 'Sin resultados',
        emptyMessage: 'Ningún usuario coincide con la búsqueda o el filtro aplicado.',
        emptyActionLabel: 'Limpiar filtros',
      },
    ),
    alCargar: (lista) => this.dialogo.listaLista(lista),
  });

  /** Los contadores de los chips se calculan sobre lo ya buscado, para que no mientan. */
  readonly filterTabs$ = this.lista.buscadas$.pipe(map(activoFilterTabs));

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
        avisarExito(this.snackBar, 'Usuario actualizado');
      } else if (guardado.desactivacionFallida) {
        // El alta ya ocurrió pero la cuenta quedó activa: más tiempo en pantalla y variante de advertencia.
        avisarAdvertencia(this.snackBar, 'Usuario creado, pero no se pudo desactivar la cuenta. Desactivala desde la lista.', {
          duracion: 10000,
        });
      } else {
        avisarExito(this.snackBar, 'Usuario creado');
      }
    },
    noEncontrada: 'No encontramos ese usuario. Puede que lo hayan eliminado.',
  });

  ngOnInit(): void {
    // Emite en el acto (la sesión es un BehaviorSubject), así que está lista antes del primer render.
    this.facade.sesion$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sesion) => { this.sesion = sesion; this.cdr.markForCheck(); });
    this.lista.cargar();
  }

  /** El CTA del estado vacío crea o limpia según por qué está vacío. */
  onEmptyAction(): void {
    this.lista.accionDeVacio(() => this.onCreate());
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

    if (deCuenta && ofreceCambioDePassword(usuario.rol)) {
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
      avisarError(this.snackBar, 'No pudimos abrir el formulario. Revisá tu conexión e intentá de nuevo.');
      return;
    } finally {
      this.abriendoCredencial = false;
    }
    if (!guardado) return;
    avisarExito(this.snackBar, modo === 'email' ? 'Email actualizado' : 'Contraseña actualizada');
  }

  onEliminar(usuario: UsuarioVM): void {
    const nombre = this.nombreCompleto(usuario);
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: {
        title: '¿Eliminar el usuario definitivamente?',
        message: mensajeDeEliminar(nombre),
        highlight: nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando…',
        confirmAction: () => this.facade.deleteDefinitive(usuario.id),
        errorDeAccion: (err) => errorDeAccionDeCuenta(err, 'eliminar', this.sesion?.rol ?? null),
      },
      aviso: 'Usuario eliminado',
      ocupado: this.lista.ocupar(usuario.id),
      foco: { host: this.host },
    });
  }

  onDesactivar(usuario: UsuarioVM): void {
    this.confirmarEstado(usuario, false);
  }

  onActivar(usuario: UsuarioVM): void {
    this.confirmarEstado(usuario, true);
  }

  private confirmarEstado(usuario: UsuarioVM, activo: boolean): void {
    const { exito, ...textos } = confirmacionDeEstado(this.nombreCompleto(usuario), activo);
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: {
        ...textos,
        highlight: this.nombreCompleto(usuario),
        // Estado explícito (el que confirmó el usuario), nunca un toggle: ver `UsuariosFacade.setAccountStatus`.
        confirmAction: () => this.facade.setAccountStatus(usuario.id, activo),
        // 403 `4029` (cuenta privilegiada o fuera de alcance): texto propio, no el `message` del backend.
        errorDeAccion: (err) => errorDeAccionDeCuenta(err, activo ? 'activar' : 'desactivar', this.sesion?.rol ?? null),
      },
      aviso: exito,
      ocupado: this.lista.ocupar(usuario.id),
    });
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
}
