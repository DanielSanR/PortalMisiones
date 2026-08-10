import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Banner resumen de errores de validación (patrón FORM).
 * Se muestra arriba del `.form-card` cuando el usuario intenta guardar
 * un formulario inválido. Presentacional puro: recibe los mensajes ya
 * resueltos (label + motivo) y no conoce el FormGroup.
 */
@Component({
  selector: 'app-form-error-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './form-error-banner.component.html',
  styleUrl: './form-error-banner.component.scss',
})
export class FormErrorBannerComponent {
  /** Mensajes por campo, ej. `"CUIT (formato inválido)"`. */
  @Input() errors: string[] = [];
}
