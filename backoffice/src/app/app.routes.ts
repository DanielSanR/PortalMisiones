import { Routes } from '@angular/router';
import { authGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./pages/pages.module').then((m) => m.PagesModule),
    canActivate: [authGuard]
  },
  {
    // Enlace del email de recuperación (el backend arma /change-password/<token> en la raíz).
    path: 'change-password/:token',
    loadComponent: () =>
      import('./auth/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
  },
  {
    path: '',
    redirectTo: '/auth/login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: '/auth/login',
  },
];
