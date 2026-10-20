import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { EstadoVigencia } from '@features/adopciones';

const TONOS: Record<EstadoVigencia | 'deshabilitada', string> = {
  vigente: 'success',
  programada: 'info',
  vencida: 'warning',
  deshabilitada: 'neutral',
};

const ETIQUETAS: Record<EstadoVigencia, string> = {
  vigente: 'Vigente',
  programada: 'Programada',
  vencida: 'Vencida',
};

/**
 * Estado de una adopción como pill global (`.pill`, mismo lenguaje que `app-estado-badge`): vigente,
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
  /** Con borde y un punto más grande: para membretes de detalle (en tablas va sin borde). */
  @Input() bordered = false;

  get clave(): EstadoVigencia | 'deshabilitada' {
    return this.habilitada ? this.estado : 'deshabilitada';
  }

  /** Modificador de tono de la pill (`pill--<tono>`). */
  get tono(): string {
    return TONOS[this.clave];
  }

  get etiqueta(): string {
    return this.habilitada ? ETIQUETAS[this.estado] : 'Deshabilitada';
  }
}
