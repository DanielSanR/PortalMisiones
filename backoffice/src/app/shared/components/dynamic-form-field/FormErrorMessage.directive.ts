import { Directive, DoCheck, ElementRef, Input, Renderer2 } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { FieldConfig } from '../../../core/models/field.interface';
import { getControlErrorMessage } from './form-error-messages.util';

/**
 * Pinta el mensaje de error inline (patrón FORM: ícono `ph-warning-circle` + texto rojo,
 * debajo del campo). Reemplaza el `<mat-error>` nativo de Material para poder incluir el
 * ícono; los mensajes/prioridad viven en `form-error-messages.util.ts` (compartidos con el
 * banner resumen de `DynamicFormComponent`).
 *
 * Se recalcula en `ngDoCheck` comparando el mensaje que corresponde con el pintado, y NO
 * escuchando `statusChanges`: `touched` (blur, `markAllAsTouched()` al enviar) no emite ningún
 * evento del control, así que con la suscripción el texto quedaba vacío aunque el campo ya se
 * mostrara inválido. `ngDoCheck` corre cada vez que se revisa la vista del campo (incluidas las
 * OnPush, que `DynamicFormComponent` refresca con su `revision` al enviar).
 */
@Directive({
  selector: '[appFormErrorMessage]',
  standalone: true,
})
export class FormErrorMessageDirective implements DoCheck {
  @Input() control: AbstractControl | null = null;
  @Input() field: FieldConfig | null = null;
  @Input() group: FormGroup | null = null;

  /** Mensaje pintado ahora (`null` = nada); evita tocar el DOM si no cambió. */
  private pintado: string | null = null;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngDoCheck(): void {
    const mensaje = this.mensajeActual();
    if (mensaje === this.pintado) return;
    this.pintado = mensaje;
    this.limpiar();
    if (mensaje) this.pintar(mensaje);
  }

  private mensajeActual(): string | null {
    if (!this.control || !this.field || !this.control.touched || this.control.valid) {
      return null;
    }

    const extraErrors =
      (this.field.name === 'startDate' || this.field.name === 'endDate') && this.group
        ? this.group.errors
        : null;

    return getControlErrorMessage(this.control, this.field, extraErrors) || null;
  }

  // Nodos creados con Renderer2 (texto como `createText`, nunca HTML): el mensaje no se interpreta.
  private pintar(mensaje: string): void {
    const icono = this.renderer.createElement('i');
    this.renderer.addClass(icono, 'ph');
    this.renderer.addClass(icono, 'ph-warning-circle');
    this.renderer.setAttribute(icono, 'aria-hidden', 'true');
    const texto = this.renderer.createElement('span');
    this.renderer.appendChild(texto, this.renderer.createText(mensaje));
    this.renderer.appendChild(this.el.nativeElement, icono);
    this.renderer.appendChild(this.el.nativeElement, texto);
  }

  private limpiar(): void {
    const host: HTMLElement = this.el.nativeElement;
    while (host.firstChild) {
      this.renderer.removeChild(host, host.firstChild);
    }
  }
}
