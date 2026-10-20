import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, of, switchMap, map } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { FormErrorBannerComponent } from '../../../shared/components/form-error-banner/form-error-banner.component';
import { extractErrorMessage } from '@core/models/api-response.model';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { UsuariosFacade, UsuarioFormValue } from '@features/usuarios';
import { OrganismoOption } from '@features/organismos';
import { AuthTokenService } from '@core/services/auth-token.service';
import { UserRole, ROLE_TO_SPANISH } from '@core/enums/user-role.enum';

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    LoadingComponent,
    FormErrorBannerComponent,
  ],
  templateUrl: './usuario-form.component.html',
  styleUrls: ['./usuario-form.component.scss'],
})
export class UsuarioFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  isEdit = false;
  saving = false;
  loading = true;
  hidePassword = true;
  /** Motivo del último fallo de guardado, para mostrarlo dentro del formulario. */
  serverError = '';
  /** La carga de organismos/roles falló: sin ellos el formulario no se puede completar. */
  loadError = '';
  /** true tras un intento de envío inválido: habilita el banner resumen. */
  submitted = false;
  organismos: OrganismoOption[] = [];

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

  ngOnInit(): void {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;

    this.buildForm();
    this.watchRolChanges();
    void this.cargar();
  }

  /** Reintento del estado de error de carga. */
  reintentar(): void {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    this.cdr.markForCheck();

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
        });
        // Cargar los datos del usuario no es un cambio del usuario: sin esto el
        // formulario nacería sucio y el guard preguntaría al salir sin haber tocado nada.
        this.form.markAsPristine();
      } else if (!this.isSuperAdmin && this.currentOrganismoId) {
        this.form.patchValue({ organismoId: this.currentOrganismoId });
        this.form.get('organismoId')?.disable();
      }
    } catch (err: unknown) {
      // Antes era un `try/finally` sin `catch`: el formulario quedaba vacío y en
      // silencio, con el select de rol sin opciones, indistinguible de un alta normal.
      this.loadError = extractErrorMessage((err as { error?: unknown })?.error)
        || 'No pudimos cargar los datos del formulario. Revisá tu conexión e intentá de nuevo.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  get requiresOrganismo(): boolean {
    const rol = this.form?.get('rol')?.value;
    return rol === UserRole.ADMIN_ORGANIZATION || rol === UserRole.AGENT;
  }

  /**
   * En edición, guardar sin cambios es una llamada al backend que no hace nada:
   * el botón queda deshabilitado con la explicación en el tooltip.
   */
  get sinCambios(): boolean {
    return this.isEdit && !!this.form?.pristine;
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
      this.submitted = true;
      this.cdr.markForCheck();
      return;
    }

    this.submitted = false;
    this.saving = true;
    this.serverError = '';
    const raw = this.form.getRawValue();
    const formValue: UsuarioFormValue = {
      nombre:      raw.nombre,
      apellido:    raw.apellido,
      email:       raw.email,
      password:    raw.password,
      rol:         raw.rol,
      organismoId: raw.organismoId ?? null,
    };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, formValue)
      // El backend crea el usuario con accountActive=true (§3). Si el toggle está en OFF,
      // se desactiva la cuenta en cadena (PUT status-account); si está en ON, ya viene activo.
      : this.facade.create(formValue).pipe(
          switchMap((created) =>
            raw.activo
              ? of(created)
              : this.facade.setAccountStatus(created.id, false).pipe(map(() => created))
          )
        );

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.onSuccess(this.isEdit ? 'Usuario actualizado' : 'Usuario creado'),
        error: (err: unknown) => {
          this.saving = false;
          this.serverError = extractErrorMessage((err as { error?: unknown })?.error)
            || 'No se pudo guardar el usuario. Intentá de nuevo.';
          this.cdr.markForCheck();
        },
      });
  }

  private onSuccess(msg: string): void {
    // Variante del design system (fondo #1A1A2E) — Kitchen Sink §07.
    this.snackBar.open(msg, 'OK', { duration: 3000, panelClass: 'snackbar-success' });
    this.router.navigate(['/dashboard/usuarios/lista']);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/usuarios/lista']);
  }

  /**
   * Lo consulta `unsavedChangesGuard` antes de dejar salir de la pantalla.
   * Durante un guardado en curso `saving` sigue en true hasta que la navegación
   * de éxito ocurre, así que un guardado exitoso no dispara la pregunta.
   */
  tieneCambiosSinGuardar(): boolean {
    return !this.saving && !!this.form?.dirty;
  }

  fieldError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.hasError(error) && ctrl.touched);
  }

  get organismoError(): boolean {
    return !!(this.form.hasError('organismoRequerido') && this.form.get('organismoId')?.touched);
  }

  /** Mensajes "Campo (motivo)" para el banner resumen — solo tras un intento de envío inválido. */
  get errorSummary(): string[] {
    if (!this.submitted) return [];
    const fields: { name: string; label: string }[] = [
      { name: 'nombre', label: 'Nombre' },
      { name: 'apellido', label: 'Apellido' },
      { name: 'email', label: 'Email' },
      ...(this.isEdit ? [] : [{ name: 'password', label: 'Contraseña' }]),
      { name: 'rol', label: 'Rol' },
    ];
    const messages = fields
      .map(({ name, label }) => {
        const ctrl = this.form.get(name);
        if (!ctrl || ctrl.valid) return null;
        return `${label} (${this.errorReason(ctrl)})`;
      })
      .filter((m): m is string => !!m);

    if (this.organismoError) messages.push('Organismo (obligatorio para este rol)');
    return messages;
  }

  private errorReason(ctrl: AbstractControl): string {
    if (ctrl.hasError('required')) return 'obligatorio';
    if (ctrl.hasError('email')) return 'formato inválido';
    if (ctrl.hasError('minlength')) return `mínimo ${ctrl.errors?.['minlength']?.requiredLength} caracteres`;
    if (ctrl.hasError('maxlength')) return `máximo ${ctrl.errors?.['maxlength']?.requiredLength} caracteres`;
    return 'inválido';
  }
}
