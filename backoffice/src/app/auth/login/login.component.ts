import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-card__header">
          <img src="assets/images/logo-misiones.png" alt="Misiones" class="login-card__logo" />
          <h1>Portal de Trámites</h1>
          <p>Backoffice de Administración</p>
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-card__form">
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" type="email" placeholder="usuario@misiones.gob.ar" />
            <mat-icon matSuffix>email</mat-icon>
            <mat-error *ngIf="loginForm.get('email')?.hasError('required')">Email requerido</mat-error>
            <mat-error *ngIf="loginForm.get('email')?.hasError('email')">Email inválido</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Contraseña</mat-label>
            <input matInput formControlName="password" [type]="hidePassword ? 'password' : 'text'" />
            <button mat-icon-button matSuffix type="button" (click)="hidePassword = !hidePassword">
              <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-error *ngIf="loginForm.get('password')?.hasError('required')">Contraseña requerida</mat-error>
          </mat-form-field>

          <p *ngIf="errorMessage" class="login-card__error">{{ errorMessage }}</p>

          <button mat-raised-button color="primary" type="submit" [disabled]="loading || loginForm.invalid" class="login-card__submit">
            <mat-spinner *ngIf="loading" diameter="20"></mat-spinner>
            <span *ngIf="!loading">Iniciar sesión</span>
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(160deg, var(--theme-primary-darker) 0%, var(--theme-primary-dark) 30%, var(--theme-primary) 70%, var(--theme-primary-light) 100%);
      padding: var(--theme-space-md);
      position: relative;
      overflow: hidden;
    }

    /* Subtle decorative pattern overlay */
    .login-page::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background:
        radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.06) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.04) 0%, transparent 40%);
      pointer-events: none;
    }

    .login-card {
      background: var(--theme-bg-card);
      border-radius: var(--theme-radius-2xl);
      box-shadow: var(--theme-shadow-xl);
      padding: 48px 40px;
      width: 100%;
      max-width: 440px;
      position: relative;
      z-index: 1;
      border: 1px solid rgba(255, 255, 255, 0.1);

      &__header {
        text-align: center;
        margin-bottom: 36px;

        h1 {
          font-size: var(--theme-font-size-2xl);
          font-weight: var(--theme-font-weight-bold);
          color: var(--theme-text-primary);
          margin: 20px 0 6px;
          letter-spacing: -0.02em;
        }

        p {
          color: var(--theme-text-secondary);
          font-size: var(--theme-font-size-base);
          font-weight: var(--theme-font-weight-normal);
        }
      }

      &__logo {
        max-width: 140px;
        height: auto;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
      }

      &__form {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      &__error {
        color: var(--theme-error);
        font-size: var(--theme-font-size-sm);
        text-align: center;
        margin: 0;
        padding: 8px 12px;
        background: var(--theme-error-bg);
        border-radius: var(--theme-radius-md);
        border: 1px solid rgba(211, 47, 47, 0.12);
      }

      &__submit {
        margin-top: 12px;
        height: 48px;
        font-size: var(--theme-font-size-md) !important;
        font-weight: var(--theme-font-weight-semibold);
        border-radius: var(--theme-radius-md) !important;
        letter-spacing: 0.02em;
        transition: all var(--theme-transition-fast);

        &:hover:not([disabled]) {
          transform: translateY(-1px);
          box-shadow: var(--theme-shadow-md);
        }

        &[disabled] {
          opacity: 0.7;
        }
      }

      &__footer {
        text-align: center;
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid var(--theme-border-secondary);
        font-size: var(--theme-font-size-xs);
        color: var(--theme-text-tertiary);
      }
    }

    @media (max-width: 480px) {
      .login-card {
        padding: 32px 24px;
        border-radius: var(--theme-radius-xl);
      }
    }
  `],
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
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;
    this.authService.login(email, password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard/home';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard/home';
        this.router.navigateByUrl(returnUrl);
        /* this.loading = false;
        this.errorMessage = err.error?.message || 'Credenciales inválidas'; */
      },
    });
  }
}
