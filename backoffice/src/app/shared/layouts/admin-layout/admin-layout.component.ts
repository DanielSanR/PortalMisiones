import { Component, OnInit, DestroyRef, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthTokenService } from '../../../core/services/auth-token.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuthUser } from '../../../core/models/auth.model';
import { Router } from '@angular/router';
import { NAV_ITEMS, NavItem } from '../../../core/constants/role-mapping.constants';
import { UserRole } from '../../../core/enums/user-role.enum';
import { evaluateAccess } from '../../../core/utils/authorization.utils';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
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
  logoSrc= 'assets/images/logo-misiones.png';
  isMobile = false;
  isCollapsed = false;
  userName = '';
  userInitials = '';
  userRoleSpanish = '';
  filteredNavItems: NavItem[] = [];

  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

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
  }

  private applyUser(user: AuthUser | null): void {
    if (!user) {
      this.userName = '';
      this.userInitials = '';
      this.userRoleSpanish = '';
      this.filteredNavItems = [];
      this.cdr.markForCheck();
      return;
    }
    this.userName = `${user.nombre} ${user.apellido}`.trim();
    this.userInitials = `${user.nombre?.charAt(0) ?? ''}${user.apellido?.charAt(0) ?? ''}`.toUpperCase();
    this.userRoleSpanish = this.authTokenService.getUserRoleLabel();
    const ctx = { permissions: user.permissions ?? [], roles: user.roles ?? [] };
    this.filteredNavItems = NAV_ITEMS.filter((item) => evaluateAccess(ctx, item.rule));
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
    this.logoSrc = this.isCollapsed ? 'assets/images/logo-mobile.png' : 'assets/images/logo-misiones.png';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
