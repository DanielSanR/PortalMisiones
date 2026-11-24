import { Component, OnInit, DestroyRef, ElementRef, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { distinctUntilChanged, filter, map } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { UserMenuComponent } from '../user-menu/user-menu.component';
import { AppFooterComponent } from '../app-footer/app-footer.component';
import { BreadcrumbComponent } from '../breadcrumb/breadcrumb.component';
import { SidebarNavComponent } from '../sidebar-nav/sidebar-nav.component';
import { ResultadoBuscador } from '../sidebar-nav/buscador-comandos';
import { UnavailableDirective } from '@shared/directives/unavailable.directive';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthTokenService } from '@core/services/auth-token.service';
import { AuthService } from '@core/services/auth.service';
import { LayoutChromeService } from '@core/services/layout-chrome.service';
import { AtajosService } from '@core/services/atajos.service';
import { PreferenciasService } from '@core/services/preferencias.service';
import { abrirAyudaAtajos } from '@shared/utils/abrir-ayuda-atajos';
import { AuthUser } from '@core/models/auth.model';
import { NAV_GROUPS, NavGroup, NavItem } from '@core/constants/role-mapping.constants';
import { UserRole } from '@core/enums/user-role.enum';
import { AuthzContext, authzContextDe, evaluateAccess } from '@core/utils/authorization.utils';
import { etiquetaDeOrganismo, organismoDeSesion } from '@core/utils/session.utils';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatTooltipModule,
    UnavailableDirective,
    UserMenuComponent,
    AppFooterComponent,
    BreadcrumbComponent,
    SidebarNavComponent,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent implements OnInit {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  @ViewChild(SidebarNavComponent) navRef?: SidebarNavComponent;
  @ViewChild('mainContent') mainContentRef?: ElementRef<HTMLElement>;
  isMobile = false;
  isCollapsed = false;
  userName = '';
  userEmail = '';
  userInitials = '';
  userRoleSpanish = '';
  /** Organismo al que pertenece la sesión ("Nombre (SIGLA)"), o `''` si es global / no informado. */
  userOrganismo = '';

  /** Grupos accesibles para el usuario actual (gateados por permiso): el nav y el buscador de la sidebar. */
  accessibleGroups: NavGroup[] = [];
  /** Los ítems de esos grupos en una lista: las secciones contra las que el breadcrumb resuelve sus links. */
  seccionesVisibles: NavItem[] = [];
  /** Contexto de autorización del usuario actual, para gatear los comandos del buscador. */
  authz: AuthzContext = authzContextDe(null);

  /** Slot de acciones de la página activa (ver `LayoutChromeService` / `appPageActions`). */
  readonly chrome = inject(LayoutChromeService);

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialog = inject(MatDialog);
  /** Atajos de una tecla (`appAtajo`) y su preferencia on/off. */
  readonly atajos = inject(AtajosService);
  /** Se crea con el shell: la clase de densidad compacta guardada rige apenas abre cualquier pantalla logueada. */
  private readonly preferencias = inject(PreferenciasService);

  constructor(
    private breakpointObserver: BreakpointObserver,
    private authTokenService: AuthTokenService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.isMobile = result.matches;
        this.cdr.markForCheck();
      });

    // Reactivo a la sesión: el nav se refiltra si cambian usuario/permisos.
    this.authTokenService.getCurrentUser$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => this.applyUser(user));

    // Al cambiar de página el foco se mueve al <main>: si no, el lector de pantalla queda parado en el
    // link del nav que se activó. Se ignora la carga inicial (el primer NavigationEnd que ve el shell) y
    // los cambios que solo tocan query/fragment (pestañas, filtros), que no son otra página.
    let primera = true;
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        map((event) => event.urlAfterRedirects.split(/[?#]/)[0]),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (primera) {
          primera = false;
          return;
        }
        this.mainContentRef?.nativeElement.focus({ preventScroll: true });
      });

    // Atajos del shell: "/" foca el buscador de la sidebar (en mobile abre antes el sidenav) y "?" lista
    // los atajos de la pantalla. Se registran en `AtajosService`, que decide cuándo NO disparan
    // (campo editable, diálogo/menú abierto, preferencia apagada).
    const quitarBuscar = this.atajos.registrar({
      teclas: ['/'],
      descripcion: 'Buscar en el menú lateral',
      accion: () => {
        if (this.isMobile) this.sidenav.open();
        // Colapsado el buscador está oculto: se expande para poder escribir.
        if (!this.isMobile && this.isCollapsed) this.isCollapsed = false;
        this.cdr.markForCheck();
        this.navRef?.enfocarBuscador();
      },
    });
    const quitarAyuda = this.atajos.registrar({
      teclas: ['?'],
      descripcion: 'Ver los atajos de teclado',
      accion: () => abrirAyudaAtajos(this.dialog, this.atajos.listar()),
    });
    this.destroyRef.onDestroy(() => {
      quitarBuscar();
      quitarAyuda();
    });
  }

  /** "juan.perez@misiones.gob.ar" → "Juan Perez". Respaldo cuando el JWT no trae el nombre. */
  private nombreDesdeEmail(email: string): string {
    const usuario = (email ?? '').split('@')[0];
    if (!usuario) return 'Usuario';
    return usuario
      .split(/[._-]+/)
      .filter(Boolean)
      .map((parte) => parte.charAt(0).toLocaleUpperCase('es-AR') + parte.slice(1))
      .join(' ');
  }

  private applyUser(user: AuthUser | null): void {
    if (!user) {
      this.userName = '';
      this.userEmail = '';
      this.userInitials = '';
      this.userRoleSpanish = '';
      this.userOrganismo = '';
      this.authz = authzContextDe(null);
      this.setAccessibleGroups([]);
      return;
    }
    // El JWT NO trae nombre/apellido (ver AuthUser): con el backend real quedaban vacíos
    // y el bloque de perfil mostraba solo el rol. Se cae al usuario del correo, que
    // siempre está, para que nombre y rol se vean juntos como en el diseño.
    const nombreCompleto = `${user.nombre ?? ''} ${user.apellido ?? ''}`.trim();
    this.userName = nombreCompleto || this.nombreDesdeEmail(user.email);
    this.userEmail = user.email;
    this.userInitials = nombreCompleto
      ? `${user.nombre?.charAt(0) ?? ''}${user.apellido?.charAt(0) ?? ''}`.toUpperCase()
      : this.userName.slice(0, 2).toLocaleUpperCase('es-AR');
    this.userRoleSpanish = this.authTokenService.getUserRoleLabel();
    // Organismo de la sesión (`/api/auth/me`, G-2): vacío en sesiones globales o con un backend anterior.
    const organismo = organismoDeSesion(user);
    this.userOrganismo = organismo ? etiquetaDeOrganismo(organismo) : '';
    this.authz = authzContextDe(user);
    const ctx = this.authz;
    this.setAccessibleGroups(NAV_GROUPS
      .map((group) => ({ label: group.label, items: group.items.filter((item) => evaluateAccess(ctx, item.rule)) }))
      .filter((group) => group.items.length > 0));
  }

  /** El nav, el buscador y los links del breadcrumb dependen de qué secciones ve el usuario. */
  private setAccessibleGroups(groups: NavGroup[]): void {
    this.accessibleGroups = groups;
    this.seccionesVisibles = groups.flatMap((group) => group.items);
    this.cdr.markForCheck();
  }

  /** Skip-link: sin esto el `href="#contenido"` pasaría por el router (base href) en vez de mover el foco. */
  irAlContenido(event: Event): void {
    event.preventDefault();
    this.mainContentRef?.nativeElement.focus();
  }

  /**
   * Escape que llega al `mat-sidenav` (buscador vacío o foco en cualquier otro control del menú).
   * `MatDrawer` lo atiende con un listener propio y llama a `close()`, pero eso solo cambia su estado
   * interno: la animación y la clase `mat-drawer-opened` son host bindings que se pintan en la vista de
   * ESTE componente, que es OnPush y nadie marcó. Sin esto el foco volvía a la hamburguesa y el menú y el
   * fondo oscuro seguían en pantalla.
   */
  alEscapeEnMenu(): void {
    this.cdr.markForCheck();
  }

  /** Resultado elegido en el buscador de la sidebar (que ya limpió la búsqueda). */
  ejecutar(resultado: ResultadoBuscador): void {
    this.cerrarMenuEnMobile();

    switch (resultado.id) {
      case 'cerrar-sesion': this.logout(); return;
      case 'colapsar-nav': this.toggleCollapse(); return;
    }
    // `navigateByUrl` y no `navigate([...])`: una ruta con query (`?adoptar=1`) se codificaría como path.
    if (resultado.route) this.router.navigateByUrl(resultado.route);
  }

  /** En mobile el menú tapa el contenido: se cierra al elegir un destino. */
  cerrarMenuEnMobile(): void {
    if (this.isMobile) this.sidenav?.close();
  }

  /** Switcher de rol para dev. Nota: la nav ahora es por PERMISO; cambiar el rol solo afecta
   *  ítems gateados por rol (Permisos/Auditoría). Los permisos del token no se alteran. */
  changeRoleUser(role: string): void {
    const user = this.authTokenService.getCurrentUser();
    if (!user) return;

    const updatedUser: AuthUser = { ...user, role: role as UserRole, roles: [role as UserRole], roleCodes: [role] };
    localStorage.setItem('user_data', JSON.stringify(updatedUser));
    this.authTokenService.updateUserFromToken();
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    // Colapsado el input queda oculto: si quedara una búsqueda activa, el nav seguiría
    // mostrando resultados sin caja donde escribir ni forma de limpiarlos.
    if (this.isCollapsed) this.navRef?.limpiarBusqueda();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
