import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { NgIf, NgTemplateOutlet } from '@angular/common';
import {
  AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable, finalize } from 'rxjs';
import { extractErrorMessage } from '@core/models/api-response.model';
import { FieldConfig } from '@core/models/field.interface';
import { getControlErrorMessage } from '@shared/components/dynamic-form-field/form-error-messages.util';

/** Qué credencial se cambia. */
export type CredencialModo = 'email' | 'password';

export interface UsuarioCredencialDialogData {
  modo: CredencialModo;
  /** Nombre visible del usuario afectado, para el título. */
  nombre: string;
  /** Email actual: precarga el campo en modo `email`. */
  emailActual?: string;
  /** Ejecuta el cambio. El diálogo espera su resultado antes de cerrar. */
  guardar: (valor: string) => Observable<unknown>;
}

/** Política de contraseña del backend (`UtilsCommons.validPassword`): 8–20, mayúscula, minúscula y número. */
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 20;
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/;

/**
 * Campos descriptos como `FieldConfig` solo para resolver sus mensajes con el util común
 * (`FORM_ERROR_MESSAGES`): mismos textos y prioridad que el resto de los formularios.
 */
const CAMPO_EMAIL: FieldConfig = { name: 'email', label: 'Nuevo email', type: 'email' };
const CAMPO_PASSWORD: FieldConfig = {
  name: 'nueva',
  label: 'Nueva contraseña',
  type: 'password',
  validations: {
    minLength: PASSWORD_MIN,
    maxLength: PASSWORD_MAX,
    patternErrorMessage: 'Tiene que incluir mayúscula, minúscula y número',
  },
};
const CAMPO_REPETIDA: FieldConfig = { name: 'repetida', label: 'Repetir contraseña', type: 'password' };

const coinciden: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const nueva = group.get('nueva')?.value;
  const repetida = group.get('repetida')?.value;
  return nueva && repetida && nueva !== repetida ? { noCoinciden: true } : null;
};

/**
 * Cambio de email o de contraseña de un usuario desde la lista. Queda abierto mientras el
 * backend responde y, si falla, cuenta el error acá mismo para poder corregir y reintentar.
 * `afterClosed()` emite `true` solo si el cambio se guardó.
 */
@Component({
  selector: 'app-usuario-credencial-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf, NgTemplateOutlet, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './usuario-credencial-dialog.component.html',
  styleUrl: './usuario-credencial-dialog.component.scss',
})
export class UsuarioCredencialDialogComponent {
  readonly data = inject<UsuarioCredencialDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<UsuarioCredencialDialogComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly passwordMin = PASSWORD_MIN;
  readonly passwordMax = PASSWORD_MAX;

  readonly emailCtrl = new FormControl(this.data.emailActual ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });

  readonly passwordForm = new FormGroup(
    {
      nueva: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(PASSWORD_MIN),
          Validators.maxLength(PASSWORD_MAX),
          Validators.pattern(PASSWORD_PATTERN),
        ],
      }),
      repetida: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: coinciden },
  );

  guardando = false;
  errorMensaje = '';
  /** Contraseñas visibles en texto plano (botón del ojo). */
  mostrarPassword = false;

  readonly campoEmail = CAMPO_EMAIL;
  readonly campoPassword = CAMPO_PASSWORD;
  readonly campoRepetida = CAMPO_REPETIDA;

  get esEmail(): boolean {
    return this.data.modo === 'email';
  }

  get titulo(): string {
    return this.esEmail ? 'Cambiar email' : 'Cambiar contraseña';
  }

  /** El email no cambió: guardar no tendría efecto. */
  get emailSinCambios(): boolean {
    return this.emailCtrl.value.trim().toLowerCase() === (this.data.emailActual ?? '').toLowerCase();
  }

  get puedeGuardar(): boolean {
    if (this.guardando) return false;
    return this.esEmail ? this.emailCtrl.valid && !this.emailSinCambios : this.passwordForm.valid;
  }

  /** Mensaje del primer error del control, o vacío. Solo tras salir del campo. */
  mensajeDeError(control: AbstractControl, campo: FieldConfig): string {
    return control.touched ? getControlErrorMessage(control, campo) ?? '' : '';
  }

  alternarPassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  /**
   * Submit del `<form>` (botón Guardar o Enter). Frena el envío nativo: sin eso el navegador
   * "postea" el form a la URL actual y recarga la app, y el cambio nunca llega a correr.
   */
  guardar(evento?: Event): void {
    evento?.preventDefault();
    const form = this.esEmail ? this.emailCtrl : this.passwordForm;
    form.markAllAsTouched();
    if (!this.puedeGuardar) return;

    const valor = this.esEmail ? this.emailCtrl.value.trim() : this.passwordForm.controls.nueva.value;
    this.guardando = true;
    this.errorMensaje = '';
    this.dialogRef.disableClose = true;

    this.data.guardar(valor)
      .pipe(
        finalize(() => {
          this.guardando = false;
          this.dialogRef.disableClose = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (err: unknown) => {
          this.errorMensaje = extractErrorMessage((err as { error?: unknown })?.error)
            || 'No se pudo guardar el cambio. Intentá de nuevo.';
        },
      });
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}
