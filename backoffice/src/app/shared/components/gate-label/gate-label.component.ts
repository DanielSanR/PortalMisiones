import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

/**
 * Gate label — firma del dashboard (design-delta.md #1): documenta, al pie de cada widget
 * placeholder, de dónde saldría el dato real y qué permiso lo habilitará.
 *
 *   <app-gate-label source="Trámites · sin controller" permission="READ_PROCEDURE"></app-gate-label>
 */
@Component({
  selector: 'app-gate-label',
  standalone: true,
  templateUrl: './gate-label.component.html',
  styleUrl: './gate-label.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GateLabelComponent {
  /** Fuente del dato (entidad/servicio backend), ej. "Trámites · sin controller". */
  @Input({ required: true }) source = '';
  /** Permiso que habilitará el widget cuando exista el endpoint, ej. "READ_PROCEDURE". */
  @Input() permission = '';
}
