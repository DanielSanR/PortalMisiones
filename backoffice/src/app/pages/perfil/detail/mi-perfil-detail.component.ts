import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Observable, map } from 'rxjs';
import { CuentaFacade } from '@features/cuenta';
import { MembreteComponent } from '@shared/components/membrete/membrete.component';
import { UnavailableDirective } from '@shared/directives/unavailable.directive';
import { VistaDePerfil, vistaDePerfil } from './mi-perfil.vista';

/**
 * "Mi perfil": la cuenta en curso, solo lectura. Todo sale de la sesión (`/api/auth/me` ya corrió en el login y
 * en cada refresco), así que no hay pedidos ni estados de carga o error. Las preferencias tienen su propia pantalla.
 */
@Component({
  selector: 'app-mi-perfil-detail',
  standalone: true,
  imports: [AsyncPipe, MatButtonModule, MembreteComponent, UnavailableDirective],
  templateUrl: './mi-perfil-detail.component.html',
  styleUrl: './mi-perfil-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiPerfilDetailComponent {
  private readonly cuenta = inject(CuentaFacade);

  readonly vista$: Observable<VistaDePerfil> = this.cuenta.sesion$.pipe(
    map(({ usuario, rol }) => vistaDePerfil(usuario, rol)),
  );
}
