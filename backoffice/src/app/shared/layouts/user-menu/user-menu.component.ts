import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { UnavailableDirective } from '../../directives/unavailable.directive';

/**
 * Perfil del usuario en el pie de la sidebar: botón (avatar + nombre + rol) que abre el menú de cuenta.
 * Presentacional: recibe los datos ya resueltos y avisa `logout`; no conoce la sesión.
 * Los estilos del panel (que vive en el overlay) están en la clase global `.user-menu-panel`.
 */
@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [MatMenuModule, MatDividerModule, UnavailableDirective],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuComponent {
  @Input() name = '';
  @Input() email = '';
  @Input() initials = '';
  @Input() role = '';
  /** Sidebar colapsada: solo se ve el avatar (nombre y rol quedan para lectores de pantalla). */
  @Input() compact = false;
  @Output() readonly logout = new EventEmitter<void>();
}
