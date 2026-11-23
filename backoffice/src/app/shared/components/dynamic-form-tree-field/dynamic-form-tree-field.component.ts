import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FieldConfig } from '@core/models/field.interface';
import { getControlErrorMessage } from '../dynamic-form-field/form-error-messages.util';
import { TreeSelectComponent } from '../tree-select/tree-select.component';

/**
 * Campo `tree-select` de `DynamicFormFieldComponent`: el desplegable con árbol más su ayuda y su
 * error. Vive aparte para cargarse en diferido (`@defer`) solo en los formularios que lo usan,
 * como el resto de los campos con dependencias propias (acá, el overlay del CDK).
 */
@Component({
  selector: 'app-dynamic-form-tree-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TreeSelectComponent],
  templateUrl: './dynamic-form-tree-field.component.html',
  styleUrl: './dynamic-form-tree-field.component.scss',
})
export class DynamicFormTreeFieldComponent {
  @Input({ required: true }) field!: FieldConfig;
  @Input({ required: true }) group!: FormGroup;
  /**
   * Sube cada vez que el formulario cambia el estado de sus controles desde afuera de los campos
   * (`markAllAsTouched()` al enviar). Es un input solo para que los campos OnPush se revisen.
   */
  @Input() revision = 0;

  /** Mensaje del error a mostrar: solo con el control inválido y ya tocado. */
  get error(): string | null {
    const control = this.group.get(this.field.name);
    return control?.invalid && control.touched ? getControlErrorMessage(control, this.field) : null;
  }
}
