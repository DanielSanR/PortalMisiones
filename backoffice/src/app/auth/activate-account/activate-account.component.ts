import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { UnavailableDirective } from '../../shared/directives/unavailable.directive';
import { AuthShellComponent } from '../shared/auth-shell/auth-shell.component';
import { textoDeErrorHttp } from '../../core/utils/http-error-text.utils';

/**
 * Activación de cuenta vía token del email (`/auth/activacion/:token`).
 * El backend hace login automático (devuelve tokens), así que tras activar redirige al dashboard.
 */
@Component({
  selector: 'app-activate-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatProgressSpinnerModule, AuthShellComponent, UnavailableDirective],
  templateUrl: './activate-account.component.html',
  styleUrl: './activate-account.component.scss',
})
export class ActivateAccountComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  /** 'activando' | 'ok' | 'error' */
  estado: 'activando' | 'ok' | 'error' = 'activando';
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    const token = (this.route.snapshot.params['token'] ?? '') as string;
    if (!token) {
      this.estado = 'error';
      this.errorMessage = 'El enlace de activación es inválido.';
      this.cdr.markForCheck();
      return;
    }

    try {
      await firstValueFrom(this.authService.activateAccount(token));
      this.estado = 'ok';
      this.cdr.markForCheck();
      // Login automático: redirigir al dashboard.
      timer(2000)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.router.navigateByUrl('/dashboard/home'));
    } catch (err: unknown) {
      this.estado = 'error';
      // Un 4xx acá es siempre el enlace (vencido, usado o inválido): solo la conexión y el 5xx llevan otro texto.
      this.errorMessage = textoDeErrorHttp(
        err,
        'El enlace de activación expiró o ya fue utilizado.',
        { contexto: 'accion', solo: ['sin-conexion', 'servidor'] },
      );
      this.cdr.markForCheck();
    }
  }
}
