import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { ActivateAccountComponent } from './activate-account/activate-account.component';

/** Rutas del área de auth (standalone, sin NgModule). Lazy-load vía loadChildren. */
export const AUTH_ROUTES: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  // Enlace del email de activación: {front.url.backoffice}/auth/activacion/<token>
  { path: 'activacion/:token', component: ActivateAccountComponent },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
