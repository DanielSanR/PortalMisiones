import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FieldConfig } from '../../../core/models/field.interface';
import { provideFechaArDatepicker } from '../../adapters/fecha-ar-date-adapter';
import { FormErrorMessageDirective } from '../dynamic-form-field/FormErrorMessage.directive';

/**
 * Campo `datepicker` de `DynamicFormFieldComponent`.
 * Aislado para que `MatDatepicker` (~80 kB) se cargue en diferido (`@defer`) solo si el
 * formulario tiene un campo fecha.
 */
@Component({
  selector: 'app-dynamic-form-date-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideFechaArDatepicker()],
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    FormErrorMessageDirective,
  ],
  templateUrl: './dynamic-form-date-field.component.html',
  styleUrl: './dynamic-form-date-field.component.scss',
})
export class DynamicFormDateFieldComponent {
  @Input({ required: true }) field!: FieldConfig;
  @Input({ required: true }) group!: FormGroup;
  /**
   * Sube cada vez que el formulario cambia el estado de sus controles desde afuera de los campos
   * (`markAllAsTouched()` al enviar). Es un input solo para que los campos OnPush se revisen.
   */
  @Input() revision = 0;
}
