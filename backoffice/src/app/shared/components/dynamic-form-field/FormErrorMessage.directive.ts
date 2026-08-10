import { Directive, Input, OnChanges, SimpleChanges, ElementRef, Renderer2, OnDestroy } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { FieldConfig } from '../../../core/models/field.interface';
import { Subscription } from 'rxjs';
import { getControlErrorMessage } from './form-error-messages.util';

/**
 * Pinta el mensaje de error inline (patrón FORM: ícono `ph-warning-circle` + texto rojo,
 * debajo del campo). Reemplaza el `<mat-error>` nativo de Material para poder incluir el
 * ícono; los mensajes/prioridad viven en `form-error-messages.util.ts` (compartidos con el
 * banner resumen de `DynamicFormComponent`).
 */
@Directive({
  selector: '[appFormErrorMessage]',
  standalone: true,
})
export class FormErrorMessageDirective implements OnChanges, OnDestroy {
  @Input() control: AbstractControl | null = null;
  @Input() field: FieldConfig | null = null;
  @Input() group: FormGroup | null = null;

  private subscription: Subscription | null = null;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngOnChanges(changes: SimpleChanges): void {
    this.subscription?.unsubscribe();
    if (this.control) {
      this.subscription = this.control.statusChanges.subscribe(() => {
        this.updateErrorMessage();
      });
    }
    this.updateErrorMessage();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private updateErrorMessage(): void {
    this.renderer.setProperty(this.el.nativeElement, 'innerHTML', '');
    if (!this.control || !this.field || !this.control.touched) {
      return;
    }

    const extraErrors =
      (this.field.name === 'startDate' || this.field.name === 'endDate') && this.group
        ? this.group.errors
        : null;

    const message = getControlErrorMessage(this.control, this.field, extraErrors);
    if (!message) {
      return;
    }

    this.renderer.setProperty(
      this.el.nativeElement,
      'innerHTML',
      `<i class="ph ph-warning-circle" aria-hidden="true"></i><span>${message}</span>`,
    );
  }
}