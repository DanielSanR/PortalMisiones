import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { GateLabelComponent } from '../../../../shared/components/gate-label';

/**
 * Chrome común de los widgets del Home (screens-spec.md §4): ícono + título (+ subtítulo opcional,
 * usado cuando el copy cambia por scope de rol) + badge/acción decorativos en el header, cuerpo
 * proyectado vía `<ng-content>`, y `app-gate-label` fijo al pie (fuente + permiso del dato real que
 * reemplazará al placeholder). Puramente presentacional: no sabe si sus datos son de ejemplo.
 */
@Component({
  selector: 'app-dashboard-panel',
  standalone: true,
  imports: [GateLabelComponent],
  templateUrl: './dashboard-panel.component.html',
  styleUrl: './dashboard-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPanelComponent {
  @Input() icon = 'squares-four';
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() badgeCount?: number;
  @Input() badgeVariant: 'warning' | 'info' = 'warning';
  /** Texto de una acción decorativa (ej. "Abrir bandeja"). Deshabilitada: el módulo aún no existe. */
  @Input() actionLabel = '';
  @Input({ required: true }) gateSource = '';
  @Input() gatePermission = '';
}
