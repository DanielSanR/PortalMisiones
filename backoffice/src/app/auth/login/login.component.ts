import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
// Excepción documentada: auth es infra (token + rotación); queda fuera del patrón de features
// por ahora (ver migracion_arquitectura.md). AuthTokenService ya cumple rol de facade de sesión.
import { AuthService } from '../../core/services/auth.service';
import { mensajeErrorLogin } from './login-error';

@Component({
  selector: 'app-login',
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
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  hidePassword = true;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    const { email, password } = this.loginForm.value;
    try {
      await firstValueFrom(this.authService.login(email, password));
      this.router.navigateByUrl('/dashboard/home');
    } catch (err: unknown) {
      this.loading = false;
      // Distingue red caída/CORS, servidor caído, error de negocio y credenciales (ver login-error.ts).
      this.errorMessage = mensajeErrorLogin(err);
      this.cdr.markForCheck();
    }
  }
}
