import { Component, OnInit, DestroyRef, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
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
import { NAV_GROUPS, NavGroup, NavItem } from '../../../core/constants/role-mapping.constants';
import { UserRole } from '../../../core/enums/user-role.enum';
import { evaluateAccess } from '../../../core/utils/authorization.utils';

/** Grupo de nav ya filtrado por permiso + búsqueda, con su estado de colapso para el template. */
interface NavGroupView {
  label: string;
  items: NavItem[];
  isOpen: boolean;
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
  isMobile = false;
  isCollapsed = false;
  userName = '';
  userEmail = '';
  userInitials = '';
  userRoleSpanish = '';

  /** Grupos de nav visibles (por permiso + búsqueda), lo que consume el template. */
  navGroups: NavGroupView[] = [];
  searchQuery = '';

  /** Trail de breadcrumb de la sección activa (`route.data.breadcrumb`); vacío en Home = solo "Inicio". */
  breadcrumbTrail: string[] = [];

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
  }

  private applyUser(user: AuthUser | null): void {
    if (!user) {
      this.userName = '';
      this.userEmail = '';
      this.userInitials = '';
      this.userRoleSpanish = '';
      this.accessibleGroups = [];
      this.recomputeNavGroups();
      return;
    }
    this.userName = `${user.nombre} ${user.apellido}`.trim();
    this.userEmail = user.email;
    this.userInitials = `${user.nombre?.charAt(0) ?? ''}${user.apellido?.charAt(0) ?? ''}`.toUpperCase();
    this.userRoleSpanish = this.authTokenService.getUserRoleLabel();
    const ctx = { permissions: user.permissions ?? [], roles: user.roles ?? [] };
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
    this.cdr.markForCheck();
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
    this.recomputeNavGroups();
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

  private recomputeNavGroups(): void {
    const query = this.searchQuery.trim().toLowerCase();
    this.navGroups = this.accessibleGroups
      .map((group) => ({
        label: group.label,
        items: query ? group.items.filter((item) => item.label.toLowerCase().includes(query)) : group.items,
        // Con búsqueda activa se fuerza abierto para poder ver los resultados de todos los grupos.
        isOpen: query.length > 0 || !this.collapsedGroups.has(group.label),
      }))
      .filter((group) => group.items.length > 0);
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
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
