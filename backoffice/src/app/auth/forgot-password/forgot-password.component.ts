import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { CuentaFacade } from '@features/cuenta';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  form: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private cuentaFacade: CuentaFacade,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.markForCheck();

    try {
      await firstValueFrom(this.cuentaFacade.requestRecovery(this.form.value.email as string));
      this.successMessage =
        'Si el email existe en nuestro sistema, te enviamos las instrucciones para restablecer tu contraseña.';
      this.form.reset();
    } catch (err: unknown) {
      const e = err as { error?: { message?: string; details?: string } };
      this.errorMessage =
        e.error?.message || e.error?.details || 'Ocurrió un error. Intentá nuevamente.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
