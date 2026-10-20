import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { ClaveEstadoBadge, EstadoBadge, EstadoBadgePipe, claveDeEstado } from '../../pipes/estado-badge.pipe';

// Badge de estado de publicación (borrador/en revisión/publicado/despublicado).
// Recibe el `PublicationStatus` del backend ('EN_REVISION') y lo pinta con su clave visual ('revision').
// Solo mapea el estado al tono de la pill global (`.pill--borrador|revision|publicado|despublicado`, tokens --theme-estado-*).
@Component({
  selector: 'app-estado-badge',
  standalone: true,
  imports: [EstadoBadgePipe],
  templateUrl: './estado-badge.component.html',
  styleUrls: ['./estado-badge.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadoBadgeComponent {
  /** Con borde y un punto más grande: para membretes de detalle (en tablas va sin borde). */
  @Input() bordered = false;

  /** Clave visual del estado (modificador `pill--<clave>`). */
  clave: ClaveEstadoBadge | null = null;
  private valor!: EstadoBadge;

  @Input({ required: true }) set estado(valor: EstadoBadge) {
    this.valor = valor;
    this.clave = claveDeEstado(valor);
  }

  get estado(): EstadoBadge {
    return this.valor;
  }
}
