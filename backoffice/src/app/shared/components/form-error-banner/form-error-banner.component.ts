import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Banner resumen de errores de validación (patrón FORM).
 * Se muestra arriba del `.form-card` cuando el usuario intenta guardar
 * un formulario inválido. Presentacional puro: recibe los mensajes ya
 * resueltos (label + motivo) y no conoce el FormGroup.
 */
let nextId = 0;

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
  /**
   * Título alternativo. Sin esto el banner asume validación client-side
   * ("Revisá N campos"), que no aplica cuando el error viene del servidor.
   */
  @Input() titulo = '';
  /**
   * `true` (default): `role="alert"`, se anuncia solo. `false`: grupo con nombre y foco programático
   * vía {@link focus}; para el resumen de validación, que convive con los `mat-error` (polite).
   */
  @Input() live = true;

  readonly tituloId = `form-error-banner-${nextId++}-titulo`;

  @ViewChild('banner') private banner?: ElementRef<HTMLElement>;

  /** Lleva el foco al banner (solo con `live=false`). Llamar con la vista ya renderizada. */
  focus(): void {
    this.banner?.nativeElement.focus();
  }
}
