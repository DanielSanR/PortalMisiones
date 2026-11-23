import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Observable, map, of, startWith } from 'rxjs';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FieldAviso, FieldConfig } from '@core/models/field.interface';

/**
 * Campo `checkbox` (slide-toggle) de `DynamicFormFieldComponent`.
 * Aislado para que `MatSlideToggle` se descargue en diferido (`@defer`) solo en los formularios que lo usan.
 */
@Component({
  selector: 'app-dynamic-form-choice-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, ReactiveFormsModule, MatSlideToggleModule],
  templateUrl: './dynamic-form-choice-field.component.html',
  styleUrl: './dynamic-form-choice-field.component.scss',
})
export class DynamicFormChoiceFieldComponent implements OnChanges {
  @Input({ required: true }) field!: FieldConfig;
  @Input({ required: true }) group!: FormGroup;
  /**
   * Sube cada vez que el formulario cambia el estado de sus controles desde afuera de los campos
   * (`markAllAsTouched()` al enviar). Es un input solo para que los campos OnPush se revisen.
   */
  @Input() revision = 0;

  /** `field.aviso` evaluado con el valor del control (también cuando lo cambia la página, no solo un clic). */
  aviso$: Observable<FieldAviso | null> = of(null);

  ngOnChanges(): void {
    const aviso = this.field.aviso;
    const control = this.group.get(this.field.name);
    this.aviso$ = aviso && control
      ? control.valueChanges.pipe(startWith(null), map(() => aviso(control.value)))
      : of(null);
  }
}
