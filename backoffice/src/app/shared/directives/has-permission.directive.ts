import { Directive, Input, OnInit, TemplateRef, ViewContainerRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthTokenService } from '../../core/services/auth-token.service';

/**
 * Directiva estructural de gating por PERMISO atómico (no por rol).
 *
 *   <button *appHasPermission="'CREATE_USUARIO'">Nuevo</button>
 *   <div *appHasPermission="['UPDATE_ROL','DELETE_ROL']">…</div>            (any por defecto)
 *   <div *appHasPermission="['READ_ROL','READ_USUARIO']; mode:'all'">…</div> (todos)
 *
 * Reactiva al usuario actual (re-evalúa si cambia la sesión, p. ej. el switcher de rol dev).
 */
@Directive({ selector: '[appHasPermission]', standalone: true })
export class HasPermissionDirective implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private permissions: string[] = [];
  private mode: 'any' | 'all' = 'any';
  private hasView = false;

  constructor(
    private tpl: TemplateRef<unknown>,
    private vc: ViewContainerRef,
    private auth: AuthTokenService
  ) {}

  @Input({ required: true }) set appHasPermission(value: string | string[]) {
    this.permissions = Array.isArray(value) ? value : [value];
    this.update();
  }

  @Input() set appHasPermissionMode(mode: 'any' | 'all') {
    this.mode = mode;
    this.update();
  }

  ngOnInit(): void {
    this.auth.getCurrentUser$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.update());
  }

  private update(): void {
    const allowed = this.evaluate();
    if (allowed && !this.hasView) {
      this.vc.createEmbeddedView(this.tpl);
      this.hasView = true;
    } else if (!allowed && this.hasView) {
      this.vc.clear();
      this.hasView = false;
    }
  }

  private evaluate(): boolean {
    if (this.permissions.length === 0) return false;
    if (this.permissions.length === 1) return this.auth.hasPermission(this.permissions[0]);
    return this.mode === 'all'
      ? this.auth.hasAllPermissions(...this.permissions)
      : this.auth.hasAnyPermission(...this.permissions);
  }
}
