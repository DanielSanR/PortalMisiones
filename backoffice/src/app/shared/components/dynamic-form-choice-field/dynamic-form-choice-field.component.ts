import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgFor } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatRadioModule } from '@angular/material/radio';
import { FieldConfig } from '../../../core/models/field.interface';

/**
 * Campos `checkbox` (slide-toggle) y `radio` de `DynamicFormFieldComponent`.
 * Aislados para que `MatSlideToggle` y `MatRadio` se descarguen en diferido (`@defer`) solo
 * en los formularios que los usan.
 */
@Component({
  selector: 'app-dynamic-form-choice-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFor, ReactiveFormsModule, MatSlideToggleModule, MatRadioModule],
  templateUrl: './dynamic-form-choice-field.component.html',
  styleUrl: './dynamic-form-choice-field.component.scss',
})
export class DynamicFormChoiceFieldComponent {
  @Input({ required: true }) field!: FieldConfig;
  @Input({ required: true }) group!: FormGroup;
  /**
   * Sube cada vez que el formulario cambia el estado de sus controles desde afuera de los campos
   * (`markAllAsTouched()` al enviar). Es un input solo para que los campos OnPush se revisen.
   */
  @Input() revision = 0;
}
