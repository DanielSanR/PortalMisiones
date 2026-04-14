import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { UsuarioService } from '../../../core/services/usuario.service';
import { OrganismoService } from '../../../core/services/organismo.service';
import { AuthTokenService } from '../../../core/services/auth-token.service';
import { UserRole, ROLE_TO_SPANISH } from '../../../core/enums/user-role.enum';
import { Organismo } from '../../../core/models/tramite.model';

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
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

  form!: FormGroup;
  isEdit = false;
  saving = false;
  loading = true;
  hidePassword = true;
  organismos: Organismo[] = [];

  readonly isSuperAdmin: boolean;
  readonly currentOrganismoId: string | null;
  readonly rolesDisponibles: { value: UserRole; label: string }[];

  private editId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private usuarioService: UsuarioService,
    private organismoService: OrganismoService,
    private authTokenService: AuthTokenService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
    this.isSuperAdmin = this.authTokenService.getUserRole() === UserRole.SUPERADMIN;
    this.currentOrganismoId = this.authTokenService.getUserOrganismoId();

    this.rolesDisponibles = this.isSuperAdmin
      ? [
          { value: UserRole.SUPERADMIN,      label: ROLE_TO_SPANISH[UserRole.SUPERADMIN] },
          { value: UserRole.ADMIN_ORGANISMO,  label: ROLE_TO_SPANISH[UserRole.ADMIN_ORGANISMO] },
          { value: UserRole.EDITOR,           label: ROLE_TO_SPANISH[UserRole.EDITOR] },
        ]
      : [{ value: UserRole.EDITOR, label: ROLE_TO_SPANISH[UserRole.EDITOR] }];
  }

  ngOnInit(): void {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;

    this.buildForm();
    this.watchRolChanges();

    const organismos$ = this.isSuperAdmin
      ? this.organismoService.getAll()
      : of({ data: [] as Organismo[] });

    const editData$ = this.isEdit && this.editId
      ? this.usuarioService.getById(this.editId)
      : of(null);

    forkJoin({ organismos: organismos$, editData: editData$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ organismos, editData }) => {
          this.organismos = organismos.data;

          if (editData) {
            this.form.patchValue({
              nombre:      editData.nombre,
              apellido:    editData.apellido,
              email:       editData.email,
              rol:         editData.rol,
              organismoId: editData.organismoId,
            });
          } else if (!this.isSuperAdmin && this.currentOrganismoId) {
            this.form.patchValue({ rol: UserRole.EDITOR, organismoId: this.currentOrganismoId });
            this.form.get('rol')?.disable();
            this.form.get('organismoId')?.disable();
          }

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  get requiresOrganismo(): boolean {
    const rol = this.form?.get('rol')?.value;
    return rol === UserRole.ADMIN_ORGANISMO || rol === UserRole.EDITOR;
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
      rol:         [UserRole.EDITOR, Validators.required],
      organismoId: [null],
    }, { validators: this.organismoValidator() });
  }

  private organismoValidator() {
    return (group: AbstractControl): ValidationErrors | null => {
      const rol = group.get('rol')?.value;
      const organismoId = group.get('organismoId')?.value;
      const needsOrg = rol === UserRole.ADMIN_ORGANISMO || rol === UserRole.EDITOR;
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
    const raw = this.form.getRawValue();

    const request$ = this.isEdit
      ? this.usuarioService.update(this.editId!, {
          nombre:      raw.nombre,
          apellido:    raw.apellido,
          rol:         raw.rol,
          organismoId: raw.organismoId ?? null,
        })
      : this.usuarioService.create({
          nombre:      raw.nombre,
          apellido:    raw.apellido,
          email:       raw.email,
          password:    raw.password,
          rol:         raw.rol,
          organismoId: raw.organismoId ?? undefined,
        });

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.onSuccess(this.isEdit ? 'Usuario actualizado' : 'Usuario creado'),
        error: () => {
          this.saving = false;
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
