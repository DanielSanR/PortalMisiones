import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
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
    PageHeaderComponent,
    LoadingComponent,
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

  permisosDisponibles: PermisoVM[] = [];

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
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
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
      return;
    }

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
}
