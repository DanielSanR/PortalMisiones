import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
// Excepción documentada: auth es infra (token + rotación); queda fuera del patrón de features
// por ahora (ver migracion_arquitectura.md). AuthTokenService ya cumple rol de facade de sesión.
import { AuthService } from '../../core/services/auth.service';
import { mensajeErrorLogin } from './login-error';
import { AuthShellComponent } from '../shared/auth-shell/auth-shell.component';
import { UnavailableDirective } from '../../shared/directives/unavailable.directive';

/** Clave de localStorage con el email recordado (nunca la contraseña). */
const CLAVE_EMAIL_RECORDADO = 'backoffice.login.email';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    AuthShellComponent,
    UnavailableDirective,
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
      recordar: [false],
    });

    const recordado = this.leerEmailRecordado();
    if (recordado) this.loginForm.patchValue({ email: recordado, recordar: true });
  }

  /** Error visible del campo: solo después de que el usuario lo tocó o intentó enviar. */
  fieldError(campo: 'email' | 'password'): boolean {
    const control = this.loginForm.get(campo);
    return !!control && control.invalid && control.touched;
  }

  async onSubmit(): Promise<void> {
    if (this.loading) return;
    if (this.loginForm.invalid) {
      // El botón queda habilitado: al enviar incompleto se señalan los campos en vez de no responder.
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    const { email, password } = this.loginForm.value;
    try {
      await firstValueFrom(this.authService.login(email, password));
      this.guardarEmailRecordado(email, !!this.loginForm.value.recordar);
      this.router.navigateByUrl('/dashboard/home');
    } catch (err: unknown) {
      this.loading = false;
      // Distingue red caída/CORS, servidor caído, error de negocio y credenciales (ver login-error.ts).
      this.errorMessage = mensajeErrorLogin(err);
      this.cdr.markForCheck();
    }
  }

  /** localStorage puede no existir (SSR) o estar bloqueado (modo privado): se ignora el fallo. */
  private leerEmailRecordado(): string {
    try {
      return typeof localStorage === 'undefined' ? '' : (localStorage.getItem(CLAVE_EMAIL_RECORDADO) ?? '');
    } catch {
      return '';
    }
  }

  private guardarEmailRecordado(email: string, recordar: boolean): void {
    try {
      if (typeof localStorage === 'undefined') return;
      if (recordar) localStorage.setItem(CLAVE_EMAIL_RECORDADO, email);
      else localStorage.removeItem(CLAVE_EMAIL_RECORDADO);
    } catch {
      // Sin persistencia: el login sigue funcionando.
    }
  }
}
