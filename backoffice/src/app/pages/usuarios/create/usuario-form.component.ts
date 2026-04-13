import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
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
  imports: [
    CommonModule,
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
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  isEdit = false;
  saving = false;
  loading = true;
  hidePassword = true;
  organismos: Organismo[] = [];

  readonly isSuperAdmin: boolean;
  readonly currentOrganismoId: string | null;

  // Roles que puede asignar el usuario logueado
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
          { value: UserRole.SUPERADMIN, label: ROLE_TO_SPANISH[UserRole.SUPERADMIN] },
          { value: UserRole.ADMIN_ORGANISMO, label: ROLE_TO_SPANISH[UserRole.ADMIN_ORGANISMO] },
          { value: UserRole.EDITOR, label: ROLE_TO_SPANISH[UserRole.EDITOR] },
        ]
      : [{ value: UserRole.EDITOR, label: ROLE_TO_SPANISH[UserRole.EDITOR] }];
  }

  ngOnInit(): void {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;

    this.buildForm();
    this.watchRolChanges();

    const loads: Array<ReturnType<typeof forkJoin | any>> = [
      this.isSuperAdmin
        ? this.organismoService.getAll().pipe(takeUntilDestroyed(this.destroyRef))
        : null,
    ].filter(Boolean);

    if (this.isSuperAdmin) {
      this.organismoService.getAll().pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({ next: (r) => (this.organismos = r.data) });
    }

    if (this.isEdit && this.editId) {
      this.usuarioService.getById(this.editId).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (usuario) => {
          this.form.patchValue({
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            email: usuario.email,
            rol: usuario.rol,
            organismoId: usuario.organismoId,
          });
          this.loading = false;
        },
        error: () => { this.loading = false; },
      });
    } else {
      // Para ADMIN_ORGANISMO: precargar su organismo
      if (!this.isSuperAdmin && this.currentOrganismoId) {
        this.form.patchValue({
          rol: UserRole.EDITOR,
          organismoId: this.currentOrganismoId,
        });
        this.form.get('rol')?.disable();
        this.form.get('organismoId')?.disable();
      }
      this.loading = false;
    }
  }

  get requiresOrganismo(): boolean {
    const rol = this.form?.get('rol')?.value;
    return rol === UserRole.ADMIN_ORGANISMO || rol === UserRole.EDITOR;
  }

  private buildForm(): void {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      apellido: ['', [Validators.required, Validators.maxLength(100)]],
      email: [{ value: '', disabled: this.isEdit }, [Validators.required, Validators.email]],
      password: [
        { value: '', disabled: this.isEdit },
        this.isEdit ? [] : [Validators.required, Validators.minLength(8)],
      ],
      rol: [UserRole.EDITOR, Validators.required],
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
    this.form.get('rol')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((rol) => {
      const organismoCtrl = this.form.get('organismoId');
      if (rol === UserRole.SUPERADMIN) {
        organismoCtrl?.setValue(null);
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

    if (this.isEdit) {
      const payload = {
        nombre: raw.nombre,
        apellido: raw.apellido,
        rol: raw.rol,
        organismoId: raw.organismoId ?? null,
      };
      this.usuarioService.update(this.editId!, payload).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: () => this.onSuccess('Usuario actualizado'),
        error: () => { this.saving = false; },
      });
    } else {
      this.usuarioService.create({
        nombre: raw.nombre,
        apellido: raw.apellido,
        email: raw.email,
        password: raw.password,
        rol: raw.rol,
        organismoId: raw.organismoId ?? undefined,
      }).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: () => this.onSuccess('Usuario creado'),
        error: () => { this.saving = false; },
      });
    }
  }

  private onSuccess(msg: string): void {
    this.snackBar.open(msg, 'OK', { duration: 3000 });
    this.router.navigate(['/dashboard/usuarios/lista']);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/usuarios/lista']);
  }

  // Helpers de validación para el template
  fieldError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.hasError(error) && ctrl.touched);
  }

  get organismoError(): boolean {
    return !!(this.form.hasError('organismoRequerido') && this.form.get('organismoId')?.touched);
  }
}
