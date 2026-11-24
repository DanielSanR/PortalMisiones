import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

/**
 * Perfil del usuario en el pie de la sidebar: botón (avatar + nombre + rol) que abre el menú de cuenta.
 * El menú es corto: la ficha de la cuenta, Mi perfil, Preferencias y Cerrar sesión (lo demás vive en esas pantallas).
 * Presentacional: recibe los datos ya resueltos y avisa `logout`; no conoce la sesión.
 * Los estilos del panel (que vive en el overlay) están en la clase global `.user-menu-panel`.
 */
@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [MatMenuModule, MatDividerModule, MatTooltipModule, RouterLink],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuComponent {
  @Input() name = '';
  @Input() email = '';
  @Input() initials = '';
  /** Rol legible: se muestra en el disparador, debajo del nombre (el desplegable no lo repite). */
  @Input() role = '';
  /** Organismo al que pertenece la cuenta; vacío (sesión global o dato no informado) = no se muestra. */
  @Input() organismo = '';
  /** Sidebar colapsada: solo se ve el avatar; nombre y rol quedan en el nombre accesible y en un tooltip. */
  @Input() compact = false;
  @Output() readonly logout = new EventEmitter<void>();

  /** Nombre accesible del disparador (y su tooltip contraído): "Menú de perfil: <nombre>, <rol>[, <organismo>]". */
  get nombreAccesible(): string {
    return `Menú de perfil: ${[this.name, this.role, this.organismo].filter((parte) => !!parte).join(', ')}`;
  }
}
