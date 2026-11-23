import { Directive, DoCheck, ElementRef, Input, Renderer2 } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { FieldConfig } from '@core/models/field.interface';
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

  /** Ícono, contenedor del texto y su nodo de texto: se crean una vez y después solo se actualizan. */
  private icono: unknown = null;
  private caja: unknown = null;
  private texto: unknown = null;

  ngDoCheck(): void {
    const mensaje = this.mensajeActual();
    if (mensaje === this.pintado) return;
    this.pintado = mensaje;
    this.pintar(mensaje ?? '');
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

  /**
   * Nodos creados con Renderer2 (texto como `createText`, nunca HTML): el mensaje no se interpreta.
   *
   * Sin mensaje, los nodos se ocultan y se vacían, NO se quitan. Antes se quitaban con
   * `while (host.firstChild) renderer.removeChild(...)`, y eso colgaba la pestaña: el `<mat-error>`
   * vive dentro de un contenedor animado de `mat-form-field` (`@transitionMessages`) y, con una
   * animación en curso, el renderer de animaciones difiere la baja del nodo; `firstChild` seguía ahí
   * y el `while` no terminaba nunca (caso típico: enviar el form inválido y corregir un campo).
   */
  private pintar(mensaje: string): void {
    if (!this.icono) {
      if (!mensaje) return;
      this.icono = this.renderer.createElement('i');
      this.renderer.addClass(this.icono, 'ph');
      this.renderer.addClass(this.icono, 'ph-warning-circle');
      this.renderer.setAttribute(this.icono, 'aria-hidden', 'true');
      this.caja = this.renderer.createElement('span');
      this.texto = this.renderer.createText(mensaje);
      this.renderer.appendChild(this.caja, this.texto);
      this.renderer.appendChild(this.el.nativeElement, this.icono);
      this.renderer.appendChild(this.el.nativeElement, this.caja);
      return;
    }

    this.renderer.setValue(this.texto, mensaje);
    for (const nodo of [this.icono, this.caja]) {
      if (mensaje) this.renderer.removeStyle(nodo, 'display');
      else this.renderer.setStyle(nodo, 'display', 'none');
    }
  }
}
