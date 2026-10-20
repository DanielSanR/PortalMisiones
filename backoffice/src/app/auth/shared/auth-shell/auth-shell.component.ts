import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { UnavailableDirective } from '../../../shared/directives/unavailable.directive';

/**
 * Layout split compartido por todas las pantallas de auth (login, recuperar, restablecer, activar):
 * hero institucional navy a la izquierda y tarjeta con el contenido proyectado a la derecha.
 * El título de la tarjeta es el `<h1>` de la página; el título del hero es decorativo (`<p>`).
 *
 * Slots: contenido por defecto = cuerpo de la tarjeta; `[authFooter]` = pie (aviso legal, sellos).
 */
@Component({
  selector: 'app-auth-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UnavailableDirective],
  templateUrl: './auth-shell.component.html',
  styleUrl: './auth-shell.component.scss',
})
export class AuthShellComponent {
  @Input({ required: true }) titulo = '';
  @Input() subtitulo = '';

  readonly anioActual = new Date().getFullYear();
}
