import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { ActivateAccountComponent } from './activate-account/activate-account.component';

/** Rutas del área de auth (standalone, sin NgModule). Lazy-load vía loadChildren. */
export const AUTH_ROUTES: Routes = [
  // `title` alimenta AppTitleStrategy: "<title> · Backoffice Misiones" (WCAG 2.4.2).
  { path: 'login', component: LoginComponent, title: 'Iniciar sesión' },
  { path: 'forgot-password', component: ForgotPasswordComponent, title: 'Recuperar contraseña' },
  { path: 'reset-password', component: ResetPasswordComponent, title: 'Restablecer contraseña' },
  // Enlace del email de activación: {front.url.backoffice}/auth/activacion/<token>
  { path: 'activacion/:token', component: ActivateAccountComponent, title: 'Activar cuenta' },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
