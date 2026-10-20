import { Directive, Input, OnInit, TemplateRef, ViewContainerRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthTokenService } from '../../core/services/auth-token.service';
import { AccessRule } from '../../core/models/access-rule.model';

/**
 * Directiva estructural de gating por PERMISO atómico (no por rol).
 *
 *   <button *appHasPermission="'CREATE_USER'">Nuevo</button>
 *   <div *appHasPermission="['UPDATE_CATEGORY','DELETE_CATEGORY']">…</div>       (any por defecto)
 *   <div *appHasPermission="['CREATE_MODALITY','UPDATE_MODALITY']; mode:'all'">…</div> (todos)
 *   <button *appHasPermission="reglaDeAcceso">…</button>   (AccessRule completa: permisos y/o roles)
 *
 * Reactiva al usuario actual (re-evalúa si cambia la sesión, p. ej. el switcher de rol dev).
 */
@Directive({ selector: '[appHasPermission]', standalone: true })
export class HasPermissionDirective implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private permissions: string[] = [];
  /** Si se pasó una `AccessRule`, se evalúa entera (incluye `requireRoles`). */
  private rule: AccessRule | null = null;
  private mode: 'any' | 'all' = 'any';
  private hasView = false;

  constructor(
    private tpl: TemplateRef<unknown>,
    private vc: ViewContainerRef,
    private auth: AuthTokenService
  ) {}

  @Input({ required: true }) set appHasPermission(value: string | string[] | AccessRule) {
    const esRegla = typeof value === 'object' && !Array.isArray(value);
    this.rule = esRegla ? value : null;
    this.permissions = esRegla ? [] : Array.isArray(value) ? value : [value];
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
    if (this.rule) return this.auth.canAccess(this.rule);
    if (this.permissions.length === 0) return false;
    // `can*` aplica los prerrequisitos de la UI (ej. CREATE_USER → READ_ORGANISM + rol admin),
    // así el botón queda alineado con la ruta y el nav sin hardcodear el rol en el template.
    if (this.permissions.length === 1) return this.auth.can(this.permissions[0]);
    return this.mode === 'all'
      ? this.auth.canAll(...this.permissions)
      : this.auth.canAny(...this.permissions);
  }
}
