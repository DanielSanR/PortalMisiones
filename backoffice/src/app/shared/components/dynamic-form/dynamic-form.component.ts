import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FieldConfig } from '../../../core/models/field.interface';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DynamicFormFieldComponent } from '../dynamic-form-field/dynamic-form-field.component';
import { FormErrorBannerComponent } from '../form-error-banner/form-error-banner.component';
import { getControlErrorMessage } from '../dynamic-form-field/form-error-messages.util';

/** Tipos de campo sin control reactivo propio ni label overline externo. */
const NO_EXTERNAL_LABEL_TYPES = ['tip', 'section-header', 'checkbox'];

@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    DynamicFormFieldComponent,
    FormErrorBannerComponent,
  ],
  templateUrl: './dynamic-form.component.html',
  styleUrls: ['./dynamic-form.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DynamicFormComponent implements OnInit {
  @Input() fields: FieldConfig[] = [];
  @Input() submitButtonText = 'Guardar';
  @Input() cancelButtonText = 'Cancelar';
  @Input() initialData?: any;
  @Input() hideButtons = false;
  @Input() saving = false;
  /**
   * Deshabilita "Guardar" mientras no haya cambios (`flows/saving-changes`, paso 2).
   *
   * Es opt-in y no default: aplica a la EDICIÓN, donde un guardado sin cambios es un
   * request al pedo y una fecha de modificación falsa. En un alta no corresponde —un
   * formulario con todo por defecto sería imposible de enviar—, así que las pantallas
   * lo atan a su propio `isEdit`.
   */
  @Input() requireChanges = false;
  /**
   * Mensaje devuelto por el backend al fallar el guardado. El contrato actual solo trae
   * `{code, message}` —sin errores por campo—, así que se muestra como banner general;
   * anclarlo a un campo puntual requeriría que el backend informe cuál falló.
   */
  @Input() serverError = '';
  @Input() helpText = 'Los cambios se publican al guardar.';

  @Output() formSubmit = new EventEmitter<any>();
  @Output() formCancel = new EventEmitter<void>();

  form!: FormGroup;
  /** true luego del primer intento de envío inválido: habilita el banner resumen. */
  submitted = false;

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['fields'] && !changes['fields'].firstChange) {
      this.initForm();
    }
    if (changes['initialData'] && !changes['initialData'].firstChange) {
      if (this.form && changes['initialData'].currentValue) {
        this.form.patchValue(changes['initialData'].currentValue);
        this.form.markAsPristine();
      }
    }
  }

  private initForm() {
    const group = this.fb.group({});

    this.fields.forEach(field => {
      if (field.type === 'tip' || field.type === 'section-header') return;

      const validators = this.getValidators(field);
      const initialValue = this.initialData?.[field.name] ?? field.value ?? '';

      if (field.disabled) {
        group.addControl(field.name, this.fb.control({ value: initialValue, disabled: true }, validators));
      } else {
        group.addControl(field.name, this.fb.control(initialValue, validators));
      }
    });

    this.form = group;
    this.form.markAsPristine();
  }

  private getValidators(field: FieldConfig) {
    const validators = [];

    if (field.validations) {
      if (field.validations.required) validators.push(Validators.required);
      if (field.validations.maxLength) validators.push(Validators.maxLength(field.validations.maxLength));
      if (field.validations.minLength) validators.push(Validators.minLength(field.validations.minLength));
      if (field.validations.min != null) validators.push(Validators.min(field.validations.min));
      if (field.validations.max != null) validators.push(Validators.max(field.validations.max));
      if (field.validations.pattern) validators.push(Validators.pattern(field.validations.pattern));
      if (field.validations.email) validators.push(Validators.email);
    }

    return validators;
  }

  /** El campo lleva label overline externo (todos salvo tip/section-header/checkbox). */
  showExternalLabel(field: FieldConfig): boolean {
    return !NO_EXTERNAL_LABEL_TYPES.includes(field.type);
  }

  /** Mensajes "Label (motivo)" de los campos inválidos y tocados — banner resumen. */
  invalidFieldMessages(): string[] {
    if (!this.form) return [];
    return this.fields
      .filter((field) => this.showExternalLabel(field) && this.form.contains(field.name))
      .map((field) => {
        const control = this.form.get(field.name);
        if (!control || control.valid || !control.touched) return null;
        const message = getControlErrorMessage(control, field);
        return message ? `${field.label} (${message})` : null;
      })
      .filter((msg): msg is string => !!msg);
  }

  getFieldCssClass(field: FieldConfig): string {
    if (field.cssClass) {
      switch (field.cssClass) {
        case 'colspan-wide': return 'dynamic-form-field-wide';
        case 'colspan-third': return 'dynamic-form-field-third';
        case 'colspan-half': return 'dynamic-form-field-half';
        case 'colspan-full': return 'dynamic-form-field-full';
        default: return 'dynamic-form-field-full';
      }
    }

    const fullWidthTypes = ['textarea', 'select', 'select-multiple', 'checkbox', 'tip', 'section-header'];
    if (fullWidthTypes.includes(field.type)) return 'dynamic-form-field-full';

    const halfWidthTypes = ['datepicker', 'number'];
    if (halfWidthTypes.includes(field.type)) return 'dynamic-form-field-half';

    return 'dynamic-form-field-full';
  }

  submit() {
    if (this.form.valid) {
      this.submitted = false;
      this.formSubmit.emit(this.form.getRawValue());
    } else {
      this.form.markAllAsTouched();
      this.submitted = true;
    }
  }
}
