import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { ClaveEstadoBadge, EstadoBadge, EstadoBadgePipe, claveDeEstado } from '../../pipes/estado-badge.pipe';

// Badge de estado de publicación (borrador/en revisión/publicado/despublicado).
// Acepta la forma del mock viejo de trámites ('revision') y la del backend ('EN_REVISION').
// Pill full + dot 6px del color del estado, tokens --theme-estado-*.
@Component({
  selector: 'app-estado-badge',
  standalone: true,
  imports: [EstadoBadgePipe],
  templateUrl: './estado-badge.component.html',
  styleUrls: ['./estado-badge.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadoBadgeComponent {
  /** Clave visual (`data-estado`), igual para las dos formas del estado. */
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
