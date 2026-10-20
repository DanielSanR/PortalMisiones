import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FieldConfig } from '../../../core/models/field.interface';
import { FormErrorMessageDirective } from '../dynamic-form-field/FormErrorMessage.directive';

/**
 * Campo `select` / `select-multiple` de `DynamicFormFieldComponent`.
 * Vive aparte para que `MatSelect` se descargue en diferido (`@defer`) solo cuando un
 * formulario tiene un campo de este tipo, y no en todos.
 */
@Component({
  selector: 'app-dynamic-form-select-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf, NgFor, ReactiveFormsModule, MatFormFieldModule, MatSelectModule, FormErrorMessageDirective],
  templateUrl: './dynamic-form-select-field.component.html',
  styleUrl: './dynamic-form-select-field.component.scss',
})
export class DynamicFormSelectFieldComponent {
  @Input({ required: true }) field!: FieldConfig;
  @Input({ required: true }) group!: FormGroup;
  /**
   * Sube cada vez que el formulario cambia el estado de sus controles desde afuera de los campos
   * (`markAllAsTouched()` al enviar). Es un input solo para que los campos OnPush se revisen.
   */
  @Input() revision = 0;
  @Input() multiple = false;
}
