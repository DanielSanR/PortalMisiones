import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Barra de acciones al pie de un formulario (patrón FORM): ayuda a la izquierda, "Cancelar" y el
 * botón de envío a la derecha. Va DENTRO del `<form>` de quien la usa: el botón es `type="submit"`,
 * así que dispara el `(ngSubmit)` de ese formulario (el envío es del DOM, no del componente).
 *
 * `sinCambios` bloquea el envío de una edición sin cambios y lo explica en un tooltip. El tooltip
 * no puede colgar de un `disabled` nativo (no recibe foco ni hover): va en un envoltorio que solo
 * es focusable mientras el botón está bloqueado por ese motivo.
 *
 * Presentacional puro: no conoce el `FormGroup`. Los estilos de `.form-actions*` son globales
 * (`shared-styles/_components.scss`).
 */
@Component({
  selector: 'app-form-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, MatButtonModule, MatTooltipModule],
  templateUrl: './form-actions.component.html',
  styleUrl: './form-actions.component.scss',
})
export class FormActionsComponent {
  @Input() helpText = '';
  @Input() cancelText = 'Cancelar';
  @Input() submitText = 'Guardar';
  /** Texto del botón mientras `saving`: se conserva junto al spinner para que no pierda su nombre accesible. */
  @Input() savingText = 'Guardando…';
  @Input() saving = false;
  /** Edición sin nada que guardar: el botón queda deshabilitado, con el motivo en el tooltip. */
  @Input() sinCambios = false;
  /** Variante de Material del botón de envío. Cada pantalla conserva la que ya tenía. */
  @Input() apariencia: 'raised' | 'flat' = 'raised';

  @Output() cancelar = new EventEmitter<void>();

  /** El bloqueo que explica el tooltip: sin cambios y sin un guardado en curso. */
  get bloqueadoSinCambios(): boolean {
    return this.sinCambios && !this.saving;
  }
}
