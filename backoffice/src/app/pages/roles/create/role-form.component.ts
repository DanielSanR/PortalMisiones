import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { FormErrorBannerComponent } from '../../../shared/components/form-error-banner/form-error-banner.component';
import { buildPermisoGroups, PermisoGroupVM } from '@core/utils/permiso-groups.util';
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
    MatIconModule,
    MatSnackBarModule,
    LoadingComponent,
    FormErrorBannerComponent,
  ],
  templateUrl: './role-form.component.html',
  styleUrl: './role-form.component.scss',
})
export class RoleFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  isEdit = false;
  saving = false;
  loading = true;
  /** true tras un intento de envío inválido: habilita el banner resumen. */
  submitted = false;

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

  async ngOnInit(): Promise<void> {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;
    this.buildForm();

    try {
      const { permisos, rol } = await firstValueFrom(this.facade.getFormData(this.editId));
      this.permisosDisponibles = permisos;

      if (rol) {
        this.form.patchValue({
          codigo:               rol.codigo,
          descripcion:          rol.descripcion,
          scopeTipo:            rol.scopeTipo,
          asignablePorOrgAdmin: rol.asignablePorOrgAdmin,
          active:               true,
          permissionsIds:       rol.permisos.map(p => p.id),
        });
      }
      this.refreshPermisoGroups();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
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
      active:               [true],
      permissionsIds:       [[] as string[]],
    });
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
    const raw = this.form.getRawValue();
    const formValue: RolFormValue = {
      codigo:               raw.codigo,
      descripcion:          raw.descripcion,
      scopeTipo:            raw.scopeTipo,
      asignablePorOrgAdmin: raw.asignablePorOrgAdmin,
      active:               raw.active,
      permissionsIds:       raw.permissionsIds ?? [],
    };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, formValue)
      : this.facade.create(formValue);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.onSuccess(this.isEdit ? 'Rol actualizado' : 'Rol creado'),
        error: () => {
          this.saving = false;
          this.cdr.markForCheck();
        },
      });
  }

  private onSuccess(msg: string): void {
    this.snackBar.open(msg, 'OK', { duration: 3000 });
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
}
