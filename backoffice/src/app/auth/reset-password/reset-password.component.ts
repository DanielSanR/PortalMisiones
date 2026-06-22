import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom, timer } from 'rxjs';
import { CuentaFacade } from '@features/cuenta';

/** Valida que `password` y `confirmPassword` sean idénticos (nivel de grupo). */
const passwordsMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const pass = group.get('password')?.value as string;
  const confirm = group.get('confirmPassword')?.value as string;
  return pass && confirm && pass !== confirm ? { passwordsMismatch: true } : null;
};

@Component({
  selector: 'app-reset-password',
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
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  form: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';
  tokenInvalido = false;
  hidePassword = true;
  hideConfirm = true;

  private token = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private cuentaFacade: CuentaFacade,
    private cdr: ChangeDetectorRef,
    private destroyRef: DestroyRef
  ) {
    this.form = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordsMatchValidator }
    );
  }

  ngOnInit(): void {
    // El enlace del email trae el token en el path (/change-password/:token); fallback a query param.
    const snap = this.route.snapshot;
    this.token = (snap.params['token'] ?? snap.queryParams['token'] ?? '') as string;
    if (!this.token) {
      this.tokenInvalido = true;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || !this.token) return;

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    const { password, confirmPassword } = this.form.value as {
      password: string;
      confirmPassword: string;
    };

    try {
      await firstValueFrom(
        this.cuentaFacade.changePassword(password, confirmPassword, this.token)
      );
      this.successMessage = 'Tu contraseña fue actualizada correctamente.';
      this.cdr.markForCheck();
      timer(2500)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.router.navigateByUrl('/auth/login'));
    } catch (err: unknown) {
      const e = err as { error?: { message?: string; details?: string } };
      this.errorMessage =
        e.error?.message || e.error?.details || 'El enlace expiró o ya fue utilizado. Solicitá uno nuevo.';
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
