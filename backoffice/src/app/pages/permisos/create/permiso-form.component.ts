import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { FormErrorBannerComponent } from '../../../shared/components/form-error-banner/form-error-banner.component';
import { extractErrorMessage } from '@core/models/api-response.model';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { PermisosFacade, PermisoFormValue } from '@features/permisos';

@Component({
  selector: 'app-permiso-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    LoadingComponent,
    FormErrorBannerComponent,
  ],
  templateUrl: './permiso-form.component.html',
  styleUrl: './permiso-form.component.scss',
})
export class PermisoFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  isEdit = false;
  saving = false;
  loading = true;
  /** true tras un intento de envío inválido: habilita el banner resumen. */
  submitted = false;
  /** Motivo del último fallo (de carga o de guardado), para mostrarlo dentro del formulario. */
  serverError = '';
  /** Título del banner: un fallo de carga no se anuncia como un fallo de guardado. */
  serverErrorTitulo = 'No se pudo guardar';

  private editId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private facade: PermisosFacade,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;
    this.buildForm();

    if (!this.isEdit || !this.editId) {
      this.loading = false;
      return;
    }

    this.facade.getById(this.editId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (permiso) => {
          this.form.patchValue({ codigo: permiso.codigo, descripcion: permiso.descripcion });
          // El form arranca pristine: en edición, "Guardar" queda deshabilitado
          // hasta que haya un cambio real (ver `sinCambios`).
          this.form.markAsPristine();
          this.loading = false;
          this.cdr.markForCheck();
        },
        // Sin esto el formulario quedaba vacío y en silencio: parecía un alta, y guardar
        // habría pisado el permiso con lo que el usuario escribiera.
        error: (err: unknown) => {
          this.serverErrorTitulo = 'No pudimos cargar el permiso';
          this.serverError = extractErrorMessage((err as { error?: unknown })?.error)
            || 'Volvé a la lista e intentá de nuevo. Si sigue, avisá a Soporte.';
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private buildForm(): void {
    this.form = this.fb.group({
      codigo:      ['', [Validators.required, Validators.maxLength(100)]],
      descripcion: ['', [Validators.required, Validators.maxLength(255)]],
    });
  }

  /**
   * En EDICIÓN no se guarda sin cambios (`flows/saving-changes`): un submit pristine es un
   * request al pedo y una fecha de modificación falsa. Es el equivalente al `[requireChanges]`
   * de `app-dynamic-form`; acá el formulario es propio porque `dynamic-form.config.ts` no
   * tiene config de PERMISO y ese archivo está fuera del alcance de esta tarea.
   */
  get sinCambios(): boolean {
    return this.isEdit && this.form.pristine;
  }

  onSubmit(): void {
    if (this.sinCambios) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitted = true;
      this.cdr.markForCheck();
      return;
    }

    this.submitted = false;
    this.saving = true;
    this.serverError = '';
    this.serverErrorTitulo = 'No se pudo guardar';
    const raw = this.form.getRawValue();
    const formValue: PermisoFormValue = {
      codigo: raw.codigo,
      descripcion: raw.descripcion,
    };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, formValue)
      : this.facade.create(formValue);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.onSuccess(this.isEdit ? 'Permiso actualizado' : 'Permiso creado'),
        // Antes solo apagaba `saving`: el botón volvía a su estado normal y no aparecía
        // nada, así que un guardado fallido era indistinguible de uno bueno.
        error: (err: unknown) => {
          this.saving = false;
          this.serverError = extractErrorMessage((err as { error?: unknown })?.error)
            || 'No se pudo guardar el permiso. Intentá de nuevo.';
          this.cdr.markForCheck();
        },
      });
  }

  private onSuccess(msg: string): void {
    // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
    this.snackBar.open(msg, 'OK', { duration: 3000, panelClass: 'snackbar-success' });
    this.router.navigate(['/dashboard/permisos/lista']);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/permisos/lista']);
  }

  /**
   * Lo consulta `unsavedChangesGuard` antes de dejar salir de la pantalla.
   * Durante un guardado en curso `saving` sigue en true hasta que la navegación de
   * éxito ocurre, así que un guardado exitoso no dispara la pregunta.
   */
  tieneCambiosSinGuardar(): boolean {
    return !this.saving && !!this.form?.dirty;
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
}
