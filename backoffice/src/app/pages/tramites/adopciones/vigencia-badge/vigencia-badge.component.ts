import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { EstadoVigencia } from '@features/adopciones';

const ETIQUETAS: Record<EstadoVigencia, string> = {
  vigente: 'Vigente',
  programada: 'Programada',
  vencida: 'Vencida',
};

/**
 * Estado de una adopción como pill (mismo lenguaje que `app-estado-badge` y `.bool-badge`): vigente,
 * programada o vencida según la fecha actual. Una deshabilitada (solo se ve en su detalle) gana.
 */
@Component({
  selector: 'app-vigencia-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vigencia-badge.component.html',
  styleUrl: './vigencia-badge.component.scss',
})
export class VigenciaBadgeComponent {
  @Input({ required: true }) estado!: EstadoVigencia;
  @Input() habilitada = true;

  get clave(): EstadoVigencia | 'deshabilitada' {
    return this.habilitada ? this.estado : 'deshabilitada';
  }

  get etiqueta(): string {
    return this.habilitada ? ETIQUETAS[this.estado] : 'Deshabilitada';
  }
}
