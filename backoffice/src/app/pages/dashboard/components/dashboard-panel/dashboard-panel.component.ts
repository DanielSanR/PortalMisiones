import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { GateLabelComponent } from '@shared/components/gate-label';

/**
 * Chrome común de los widgets del Home (screens-spec.md §4): ícono opcional + título (+ subtítulo
 * opcional, usado cuando el copy cambia por scope de rol) + badge/acción decorativos en el header,
 * cuerpo proyectado vía `<ng-content>`, y `app-gate-label` fijo al pie (fuente + permiso del dato
 * real que reemplazará al placeholder). Puramente presentacional: no sabe si sus datos son de ejemplo.
 *
 * Slots de proyección adicionales (para headers con contenido a medida, ej. la leyenda de
 * "Trámites por organismo" o el KPI de "Consultas del portal"):
 *   - `[panelHeaderBody]`  → debajo del título, dentro de la columna de texto del header.
 *   - `[panelHeaderExtra]` → alineado a la derecha del header (junto a `actionLabel`, si hay).
 *   - `[panelFooterExtra]` → alineado a la derecha del footer (junto a `app-gate-label`).
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
  /** Ícono del header (`ph-{{icon}}`). Vacío = sin ícono (ver "Consultas del portal"/"Trámites por organismo"). */
  @Input() icon = '';
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() badgeCount?: number;
  @Input() badgeVariant: 'warning' | 'info' = 'warning';
  /** Texto de una acción decorativa en el HEADER (ej. "Abrir bandeja"). Deshabilitada: el módulo aún no existe. */
  @Input() actionLabel = '';
  @Input({ required: true }) gateSource = '';
  @Input() gatePermission = '';
}
