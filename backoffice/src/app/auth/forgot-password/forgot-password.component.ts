import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { CuentaFacade } from '@features/cuenta';
import { AuthShellComponent } from '../shared/auth-shell/auth-shell.component';
import { textoDeErrorHttp } from '@core/utils/http-error-text.utils';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    AuthShellComponent,
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly cuentaFacade = inject(CuentaFacade);
  private readonly cdr = inject(ChangeDetectorRef);

  form: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor() {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  /** Error visible del campo: solo después de que el usuario lo tocó o intentó enviar. */
  fieldError(campo: 'email'): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

  async onSubmit(): Promise<void> {
    if (this.loading) return;
    if (this.form.invalid) {
      // El botón queda habilitado: al enviar incompleto se señalan los errores en vez de no responder.
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.markForCheck();

    try {
      await firstValueFrom(this.cuentaFacade.requestRecovery(this.form.value.email as string));
      this.successMessage =
        'Si el correo existe en nuestro sistema, te enviamos las instrucciones para restablecer tu contraseña.';
      this.form.reset();
    } catch (err: unknown) {
      this.errorMessage = textoDeErrorHttp(
        err,
        'No pudimos enviar las instrucciones. Intentá de nuevo en unos minutos; si sigue, avisá a Soporte.',
        { contexto: 'accion', solo: ['sin-conexion', 'servidor'] },
      );
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
