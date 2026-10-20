import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { FormErrorBannerComponent } from '../../../shared/components/form-error-banner/form-error-banner.component';
import { buildPermisoGroups, PermisoGroupVM } from '@core/utils/permiso-groups.util';
import { extractErrorMessage } from '@core/models/api-response.model';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { RolesFacade, RolFormValue, RoleScopeType } from '@features/roles';
import { PermisoVM } from '@features/permisos';

@Component({
  selector: 'app-role-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    LoadingComponent,
    FormErrorBannerComponent,
  ],
  templateUrl: './role-form.component.html',
  styleUrl: './role-form.component.scss',
})
export class RoleFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  isEdit = false;
  saving = false;
  loading = true;
  /** true tras un intento de envío inválido: habilita el banner resumen. */
  submitted = false;
  /** Motivo del último fallo (carga o guardado), para mostrarlo dentro del formulario. */
  serverError = '';
  /**
   * La carga de datos falló. El formulario no se dibuja: con el catálogo de permisos vacío o el
   * rol sin leer, guardar habría pisado el rol con lo que hubiera en pantalla.
   */
  cargaFallida = false;

  permisosDisponibles: PermisoVM[] = [];
  /** Permisos agrupados por recurso para el multi-select de badges (mismo look que el detalle de Roles). */
  permisoGroups: PermisoGroupVM[] = [];

  readonly scopeOpciones: { value: RoleScopeType; label: string }[] = [
    { value: 'global',    label: 'Global' },
    { value: 'organismo', label: 'Organismo' },
  ];

  private editId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private facade: RolesFacade,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;
    this.buildForm();
    this.cargar();
  }

  /**
   * Permisos disponibles + rol en edición, en una sola llamada. Antes era `firstValueFrom` dentro
   * de un `try/finally` sin `catch`: un fallo de la API dejaba el formulario vacío y en silencio.
   */
  cargar(): void {
    this.loading = true;
    this.cargaFallida = false;
    this.serverError = '';
    this.facade.getFormData(this.editId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ permisos, rol }) => {
          this.permisosDisponibles = permisos;

          if (rol) {
            this.form.patchValue({
              codigo:               rol.codigo,
              descripcion:          rol.descripcion,
              scopeTipo:            rol.scopeTipo,
              asignablePorOrgAdmin: rol.asignablePorOrgAdmin,
              asignablePorBackoffice: rol.asignablePorBackoffice,
              // El estado real del rol: fijarlo en `true` reactivaba en silencio un rol dado de baja.
              active:               rol.activo,
              permissionsIds:       rol.permisos.map((p) => p.id),
            });
            // `patchValue` no ensucia el form: en edición, "Guardar" arranca deshabilitado.
            this.form.markAsPristine();
          }
          this.refreshPermisoGroups();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.loading = false;
          this.cargaFallida = true;
          this.serverError = extractErrorMessage((err as { error?: unknown })?.error)
            || (this.isEdit
              ? 'No pudimos cargar el rol ni sus permisos. Intentá de nuevo.'
              : 'No pudimos cargar el catálogo de permisos. Intentá de nuevo.');
          this.cdr.markForCheck();
        },
      });
  }

  /** Recalcula los grupos de badges de permisos contra la selección actual del form control. */
  private refreshPermisoGroups(): void {
    const selectedIds: string[] = this.form.get('permissionsIds')?.value ?? [];
    this.permisoGroups = buildPermisoGroups(this.permisosDisponibles, new Set(selectedIds));
  }

  /** Togglea un permiso (otorgado ↔ no otorgado) desde el multi-select de badges. */
  togglePermiso(permisoId: string): void {
    const ctrl = this.form.get('permissionsIds')!;
    const current: string[] = ctrl.value ?? [];
    const next = current.includes(permisoId)
      ? current.filter((id) => id !== permisoId)
      : [...current, permisoId];
    ctrl.setValue(next);
    ctrl.markAsDirty();
    this.refreshPermisoGroups();
    this.cdr.markForCheck();
  }

  private buildForm(): void {
    this.form = this.fb.group({
      codigo:               ['', [Validators.required, Validators.maxLength(100)]],
      descripcion:          ['', [Validators.required, Validators.maxLength(255)]],
      scopeTipo:            ['global' as RoleScopeType, Validators.required],
      asignablePorOrgAdmin: [false],
      asignablePorBackoffice: [false],
      active:               [true],
      permissionsIds:       [[] as string[]],
    });
  }

  /**
   * En edición, "Guardar" queda deshabilitado hasta que haya algo que guardar (equivalente al
   * `requireChanges` de `app-dynamic-form`). En un alta no aplica: el formulario por defecto
   * sería imposible de enviar.
   */
  get sinCambios(): boolean {
    return this.isEdit && this.form.pristine;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitted = true;
      this.cdr.markForCheck();
      return;
    }

    this.submitted = false;
    this.saving = true;
    this.serverError = '';
    const raw = this.form.getRawValue();
    const formValue: RolFormValue = {
      codigo:               raw.codigo,
      descripcion:          raw.descripcion,
      scopeTipo:            raw.scopeTipo,
      asignablePorOrgAdmin: raw.asignablePorOrgAdmin,
      asignablePorBackoffice: raw.asignablePorBackoffice,
      active:               raw.active,
      permissionsIds:       raw.permissionsIds ?? [],
    };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, formValue)
      : this.facade.create(formValue);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.onSuccess(this.isEdit ? 'Rol actualizado' : 'Rol creado correctamente'),
        // Antes solo apagaba `saving`: el botón volvía a su estado normal y no aparecía nada,
        // así que un guardado fallido era indistinguible de uno bueno.
        error: (err: unknown) => {
          this.saving = false;
          this.serverError = extractErrorMessage((err as { error?: unknown })?.error)
            || 'No se pudo guardar el rol. Intentá de nuevo.';
          this.cdr.markForCheck();
        },
      });
  }

  private onSuccess(msg: string): void {
    // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
    this.snackBar.open(msg, 'OK', { duration: 3000, panelClass: 'snackbar-success' });
    this.router.navigate(['/dashboard/roles/lista']);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/roles/lista']);
  }

  fieldError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.hasError(error) && ctrl.touched);
  }

  /** Mensajes "Campo (motivo)" para el banner resumen — solo tras un intento de envío inválido. */
  get errorSummary(): string[] {
    if (!this.submitted) return [];
    const fields: { name: string; label: string }[] = [
      { name: 'codigo', label: 'Código' },
      { name: 'descripcion', label: 'Descripción' },
      { name: 'scopeTipo', label: 'Scope' },
    ];
    return fields
      .map(({ name, label }) => {
        const ctrl = this.form.get(name);
        if (!ctrl || ctrl.valid) return null;
        return `${label} (${this.errorReason(ctrl)})`;
      })
      .filter((m): m is string => !!m);
  }

  private errorReason(ctrl: AbstractControl): string {
    if (ctrl.hasError('required')) return 'obligatorio';
    if (ctrl.hasError('maxlength')) return `máximo ${ctrl.errors?.['maxlength']?.requiredLength} caracteres`;
    return 'inválido';
  }

  /**
   * Lo consulta `unsavedChangesGuard` antes de dejar salir de la pantalla.
   * Durante un guardado en curso `saving` sigue en true hasta que la navegación de éxito
   * ocurre, así que un guardado exitoso no dispara la pregunta.
   */
  tieneCambiosSinGuardar(): boolean {
    return !this.saving && !!this.form?.dirty;
  }
}
