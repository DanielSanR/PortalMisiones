import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, of, switchMap, map } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { UsuariosFacade, UsuarioFormValue } from '@features/usuarios';
import { OrganismoOption } from '@features/organismos';
import { MunicipiosFacade } from '@features/municipios';
import { AuthTokenService } from '@core/services/auth-token.service';
import { UserRole, ROLE_TO_SPANISH } from '@core/enums/user-role.enum';

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
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
  templateUrl: './usuario-form.component.html',
  styleUrls: ['./usuario-form.component.scss'],
})
export class UsuarioFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly municipiosFacade = inject(MunicipiosFacade);

  form!: FormGroup;
  isEdit = false;
  saving = false;
  loading = true;
  hidePassword = true;
  errorMessage = '';
  organismos: OrganismoOption[] = [];

  /** Localidades (datos de referencia cacheados; reales vía /api/municipality). */
  readonly municipios$ = this.municipiosFacade.municipios$;

  readonly isSuperAdmin: boolean;
  readonly currentOrganismoId: string | null;
  /** Opciones del select de rol. En CREATE → roles reales (value = UUID); en EDIT → enum (mock). */
  rolesDisponibles: { value: string; label: string }[] = [];

  // Roles para EDICIÓN (mock, por código de rol).
  private readonly rolesEdicion: { value: string; label: string }[];

  private editId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private facade: UsuariosFacade,
    private authTokenService: AuthTokenService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
    this.isSuperAdmin = this.authTokenService.getUserRole() === UserRole.SUPERADMIN;
    this.currentOrganismoId = this.authTokenService.getUserOrganismoId();

    this.rolesEdicion = this.isSuperAdmin
      ? [
          { value: UserRole.SUPERADMIN,         label: ROLE_TO_SPANISH[UserRole.SUPERADMIN] },
          { value: UserRole.ADMIN_ORGANIZATION, label: ROLE_TO_SPANISH[UserRole.ADMIN_ORGANIZATION] },
          { value: UserRole.AGENT,              label: ROLE_TO_SPANISH[UserRole.AGENT] },
        ]
      : [{ value: UserRole.AGENT, label: ROLE_TO_SPANISH[UserRole.AGENT] }];
  }

  async ngOnInit(): Promise<void> {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;

    this.buildForm();
    this.watchRolChanges();

    try {
      const { organismos, rolesAllowed, usuario } = await firstValueFrom(this.facade.getFormData(this.editId));
      this.organismos = organismos;

      // CREATE → roles reales del backend (value = UUID). EDIT → roles por código (mock).
      this.rolesDisponibles = this.isEdit
        ? this.rolesEdicion
        : rolesAllowed.map((r) => ({ value: r.id, label: r.descripcion || r.codigo }));

      if (usuario) {
        this.form.patchValue({
          nombre:      usuario.nombre,
          apellido:    usuario.apellido,
          email:       usuario.email,
          rol:         usuario.rol,
          organismoId: usuario.organismoId,
          localidadId: usuario.localidadId ?? null,
        });
      } else if (!this.isSuperAdmin && this.currentOrganismoId) {
        this.form.patchValue({ organismoId: this.currentOrganismoId });
        this.form.get('organismoId')?.disable();
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  get requiresOrganismo(): boolean {
    const rol = this.form?.get('rol')?.value;
    return rol === UserRole.ADMIN_ORGANIZATION || rol === UserRole.AGENT;
  }

  private buildForm(): void {
    this.form = this.fb.group({
      nombre:      ['', [Validators.required, Validators.maxLength(100)]],
      apellido:    ['', [Validators.required, Validators.maxLength(100)]],
      email:       [{ value: '', disabled: this.isEdit }, [Validators.required, Validators.email]],
      password:    [
        { value: '', disabled: this.isEdit },
        this.isEdit ? [] : [Validators.required, Validators.minLength(8)],
      ],
      rol:         ['', Validators.required],
      organismoId: [null],
      localidadId: [null],
      activo:      [false],
    }, { validators: this.organismoValidator() });
  }

  private organismoValidator() {
    return (group: AbstractControl): ValidationErrors | null => {
      const rol = group.get('rol')?.value;
      const organismoId = group.get('organismoId')?.value;
      const needsOrg = rol === UserRole.ADMIN_ORGANIZATION || rol === UserRole.AGENT;
      if (needsOrg && !organismoId) {
        return { organismoRequerido: true };
      }
      return null;
    };
  }

  private watchRolChanges(): void {
    this.form.get('rol')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rol) => {
        if (rol === UserRole.SUPERADMIN) {
          this.form.get('organismoId')?.setValue(null);
        }
        this.form.updateValueAndValidity();
      });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    const raw = this.form.getRawValue();
    const formValue: UsuarioFormValue = {
      nombre:      raw.nombre,
      apellido:    raw.apellido,
      email:       raw.email,
      password:    raw.password,
      rol:         raw.rol,
      organismoId: raw.organismoId ?? null,
      localidadId: raw.localidadId ?? null,
    };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, formValue)
      // Crea y, si el toggle está activo, activa la cuenta (PUT status-account) en cadena.
      : this.facade.create(formValue).pipe(
          switchMap((created) =>
            raw.activo
              ? this.facade.setAccountStatus(created.id, true).pipe(map(() => created))
              : of(created)
          )
        );

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.onSuccess(this.isEdit ? 'Usuario actualizado' : 'Usuario creado'),
        error: (err) => {
          this.saving = false;
          this.errorMessage =
            err.error?.message || err.error?.details || 'No se pudo guardar el usuario.';
          this.cdr.markForCheck();
        },
      });
  }

  private onSuccess(msg: string): void {
    this.snackBar.open(msg, 'OK', { duration: 3000 });
    this.router.navigate(['/dashboard/usuarios/lista']);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/usuarios/lista']);
  }

  fieldError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.hasError(error) && ctrl.touched);
  }

  get organismoError(): boolean {
    return !!(this.form.hasError('organismoRequerido') && this.form.get('organismoId')?.touched);
  }
}
