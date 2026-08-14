import { Component, OnInit, DestroyRef, ElementRef, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, fromEvent } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthTokenService } from '../../../core/services/auth-token.service';
import { AuthService } from '../../../core/services/auth.service';
import { LayoutChromeService } from '../../../core/services/layout-chrome.service';
import { AuthUser } from '../../../core/models/auth.model';
import { COMANDOS } from '../../../core/constants/comandos.constants';
import { NAV_GROUPS, NAV_ITEMS, NavGroup, NavItem } from '../../../core/constants/role-mapping.constants';
import { UserRole } from '../../../core/enums/user-role.enum';
import { evaluateAccess } from '../../../core/utils/authorization.utils';

/** Icono genérico cuando el primer segmento del breadcrumb no matchea ningún `NavItem`
 *  (ej. detalle de trámite, cuyo trail es ["Trámites", "Detalle"] — sí matchea; se usa
 *  solo como red de seguridad ante secciones fuera del nav). */
const FALLBACK_SECTION_ICON = 'file-text';

/** Grupo de nav ya filtrado por permiso + búsqueda, con su estado de colapso para el template. */
interface NavGroupView {
  label: string;
  items: NavItem[];
  isOpen: boolean;
}

/** Una fila de resultados del buscador (navegación o comando). */
export interface ResultadoBuscador {
  tipo: 'nav' | 'comando';
  label: string;
  icon: string;
  route?: string;
  id?: 'cerrar-sesion' | 'colapsar-nav';
}

/** Grupo del listado de resultados. `indice` es la posición en la lista plana
 *  `resultados`, para que las flechas recorran los grupos de corrido. */
interface GrupoResultado {
  titulo: string;
  items: (ResultadoBuscador & { indice: number })[];
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent implements OnInit {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('navScroll') navScrollRef?: ElementRef<HTMLElement>;
  isMobile = false;
  isCollapsed = false;
  userName = '';
  userEmail = '';
  userInitials = '';
  userRoleSpanish = '';

  /** Grupos de nav visibles (por permiso + búsqueda), lo que consume el template. */
  navGroups: NavGroupView[] = [];
  searchQuery = '';

  /** Resultados en lista plana: es el orden que recorren las flechas. */
  resultados: ResultadoBuscador[] = [];
  /** Los mismos resultados agrupados, que es lo que dibuja el nav. */
  gruposResultado: GrupoResultado[] = [];
  /** Fila bajo el cursor; -1 cuando no hay resultados. */
  indiceActivo = -1;

  /** Contexto de autorización del usuario actual, para gatear los comandos. */
  private permisosActuales: string[] = [];
  private rolesActuales: UserRole[] = [];

  /** Trail de breadcrumb de la sección activa (`route.data.breadcrumb`); vacío en Home = solo "Inicio". */
  breadcrumbTrail: string[] = [];
  /** Icono de la sección activa (icono del `NavItem` cuyo label matchea `breadcrumbTrail[0]`). */
  sectionIcon = 'layout';

  /** Slot de acciones de la página activa (ver `LayoutChromeService` / `appPageActions`). */
  readonly chrome = inject(LayoutChromeService);

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly activatedRoute = inject(ActivatedRoute);

  /** Grupos accesibles para el usuario actual (gateados por permiso), previos al filtro de búsqueda. */
  private accessibleGroups: NavGroup[] = [];
  /** Labels de grupo colapsados manualmente por el usuario (vacío = todos abiertos). */
  private readonly collapsedGroups = new Set<string>();

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

    // Breadcrumb del header: refleja `data.breadcrumb` de la ruta activa más profunda.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.updateBreadcrumb());
    this.updateBreadcrumb();

    // Atajo "/": foca el buscador de la sidebar, salvo que el foco ya esté en un campo editable.
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(
        filter((event) => event.key === '/' && !this.isEditableTarget(event.target)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        event.preventDefault();
        if (this.isMobile) this.sidenav.open();
        this.searchInputRef?.nativeElement.focus();
      });
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
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
      this.permisosActuales = [];
      this.rolesActuales = [];
      this.accessibleGroups = [];
      this.recomputeNavGroups();
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
    this.permisosActuales = user.permissions ?? [];
    this.rolesActuales = user.roles ?? [];
    const ctx = { permissions: this.permisosActuales, roles: this.rolesActuales };
    this.accessibleGroups = NAV_GROUPS
      .map((group) => ({ label: group.label, items: group.items.filter((item) => evaluateAccess(ctx, item.rule)) }))
      .filter((group) => group.items.length > 0);
    this.recomputeNavGroups();
  }

  /** Deriva `breadcrumbTrail` de la ruta hija más profunda (la que efectivamente resuelve `router-outlet`). */
  private updateBreadcrumb(): void {
    let route = this.activatedRoute.root;
    while (route.firstChild) route = route.firstChild;
    this.breadcrumbTrail = (route.snapshot.data['breadcrumb'] as string[] | undefined) ?? [];
    this.sectionIcon = this.resolveSectionIcon(this.breadcrumbTrail);
    this.cdr.markForCheck();
  }

  /** Icono de la sección activa: el de "Inicio" cuando no hay trail (Home), o el del `NavItem`
   *  cuyo `label` matchea el primer segmento del trail (ej. "Roles" → shield-star). Fallback
   *  genérico si el segmento no corresponde a ningún ítem del nav. */
  private resolveSectionIcon(trail: string[]): string {
    if (trail.length === 0) {
      return NAV_ITEMS.find((item) => item.label === 'Inicio')?.icon ?? FALLBACK_SECTION_ICON;
    }
    return NAV_ITEMS.find((item) => item.label === trail[0])?.icon ?? FALLBACK_SECTION_ICON;
  }

  trackByRoute(_index: number, item: NavItem): string {
    return item.route;
  }

  trackByGroup(_index: number, group: NavGroupView): string {
    return group.label;
  }

  /** Filtro client-side del buscador de la sidebar (sin backend). */
  onSearchInput(value: string): void {
    this.searchQuery = value;
    this.recomputeResultados();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------
  // Buscador — el nav SE CONVIERTE en los resultados (no hay panel flotante).
  // ---------------------------------------------------------------------

  /**
   * Arma la lista plana (para las flechas) y su agrupación (para el nav) en una
   * sola pasada, así los índices no se pueden desfasar entre las dos vistas.
   */
  private recomputeResultados(): void {
    const q = this.searchQuery.trim().toLocaleLowerCase('es-AR');
    if (!q) {
      this.resultados = [];
      this.gruposResultado = [];
      this.indiceActivo = -1;
      return;
    }

    const navegacion: ResultadoBuscador[] = this.accessibleGroups
      .flatMap((g) => g.items)
      .filter((item) => item.label.toLocaleLowerCase('es-AR').includes(q))
      .map((item) => ({ tipo: 'nav' as const, label: item.label, icon: item.icon, route: item.route }));

    const ctx = { permissions: this.permisosActuales, roles: this.rolesActuales };
    const comandos: ResultadoBuscador[] = COMANDOS
      .filter((c) => evaluateAccess(ctx, c.rule))
      .filter((c) => c.label.toLocaleLowerCase('es-AR').includes(q)
                  || c.keywords.some((k) => k.includes(q)))
      .map((c) => ({ tipo: 'comando' as const, label: c.label, icon: c.icon, route: c.route, id: c.id }));

    this.resultados = [...navegacion, ...comandos];
    this.gruposResultado = [
      { titulo: 'Ir a', items: navegacion.map((r, i) => ({ ...r, indice: i })) },
      { titulo: 'Acciones', items: comandos.map((r, i) => ({ ...r, indice: navegacion.length + i })) },
    ].filter((g) => g.items.length > 0);
    // Se preselecciona el primero: Enter sin tocar las flechas ejecuta lo más probable.
    this.indiceActivo = this.resultados.length > 0 ? 0 : -1;
  }

  /** Flechas para recorrer, Enter para ejecutar, Escape para limpiar. */
  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // `MatDrawer` escucha Escape en su propio elemento y cierra el sidenav. Cortamos
      // la propagación solo cuando hay algo que limpiar: si no, Escape con el buscador
      // vacío deja de cerrar el drawer en mobile, que ahí sí es lo que se espera.
      if (!this.searchQuery) return;
      event.stopPropagation();
      this.limpiarBusqueda();
      return;
    }
    if (this.resultados.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const paso = event.key === 'ArrowDown' ? 1 : -1;
      const total = this.resultados.length;
      this.indiceActivo = (this.indiceActivo + paso + total) % total;
      this.desplazarAlCursor();
      return;
    }
    if (event.key === 'Enter' && this.indiceActivo >= 0) {
      event.preventDefault();
      this.ejecutar(this.resultados[this.indiceActivo]);
    }
  }

  /** La lista vive dentro del nav, que scrollea: sin esto el cursor se va de vista
   *  con las flechas. `setTimeout` porque el alto hay que medirlo ya renderizado. */
  private desplazarAlCursor(): void {
    setTimeout(() => {
      this.navScrollRef?.nativeElement
        .querySelector('.is-cursor')
        ?.scrollIntoView({ block: 'nearest' });
    });
  }

  ejecutar(resultado: ResultadoBuscador): void {
    this.limpiarBusqueda();
    if (this.isMobile) this.sidenav?.close();

    switch (resultado.id) {
      case 'cerrar-sesion': this.logout(); return;
      case 'colapsar-nav': this.toggleCollapse(); return;
    }
    if (resultado.route) this.router.navigate([resultado.route]);
  }

  limpiarBusqueda(): void {
    this.searchQuery = '';
    this.resultados = [];
    this.gruposResultado = [];
    this.indiceActivo = -1;
    if (this.searchInputRef) this.searchInputRef.nativeElement.value = '';
    this.cdr.markForCheck();
  }

  /** Abre/cierra un grupo del nav. Estado local, no persiste entre sesiones. */
  toggleGroup(label: string): void {
    if (this.collapsedGroups.has(label)) {
      this.collapsedGroups.delete(label);
    } else {
      this.collapsedGroups.add(label);
    }
    this.recomputeNavGroups();
  }

  /** Nav en reposo. El filtrado por texto ya no vive acá: con búsqueda activa el nav
   *  no se dibuja, lo reemplaza el grupo "Ir a" de los resultados. */
  private recomputeNavGroups(): void {
    this.navGroups = this.accessibleGroups.map((group) => ({
      label: group.label,
      items: group.items,
      isOpen: !this.collapsedGroups.has(group.label),
    }));
    this.cdr.markForCheck();
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
    if (this.isCollapsed) this.limpiarBusqueda();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
