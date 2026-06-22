import { Directive, Input, OnInit, TemplateRef, ViewContainerRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthTokenService } from '../../core/services/auth-token.service';
import { UserRole } from '../../core/enums/user-role.enum';

/**
 * Directiva estructural de gating por ROL (any-of). Para políticas más estrictas que un permiso
 * atómico (p. ej. "crear usuarios solo SUPERADMIN", aunque otros roles tengan CREATE_USUARIO).
 *
 *   <button *appHasRole="'SUPERADMIN'">Nuevo</button>
 *   <div *appHasRole="['SUPERADMIN','ADMIN_BACKOFFICE']">…</div>
 *
 * Reactiva al usuario actual (re-evalúa con el switcher de rol dev).
 */
@Directive({ selector: '[appHasRole]', standalone: true })
export class HasRoleDirective implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private roles: UserRole[] = [];
  private hasView = false;

  constructor(
    private tpl: TemplateRef<unknown>,
    private vc: ViewContainerRef,
    private auth: AuthTokenService
  ) {}

  @Input({ required: true }) set appHasRole(value: UserRole | UserRole[] | string | string[]) {
    this.roles = (Array.isArray(value) ? value : [value]) as UserRole[];
    this.update();
  }

  ngOnInit(): void {
    this.auth.getCurrentUser$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.update());
  }

  private update(): void {
    const allowed = this.roles.length > 0 && this.auth.hasAnyRole(this.roles);
    if (allowed && !this.hasView) {
      this.vc.createEmbeddedView(this.tpl);
      this.hasView = true;
    } else if (!allowed && this.hasView) {
      this.vc.clear();
      this.hasView = false;
    }
  }
}
