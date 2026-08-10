import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { EstadoBadgePipe } from '../../pipes/estado-badge.pipe';
import { TramiteEstado } from '../../../core/models/tramite.model';

// Badge de estado de tramite (borrador/revision/publicado/despublicado).
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
  @Input() estado!: TramiteEstado;
}
