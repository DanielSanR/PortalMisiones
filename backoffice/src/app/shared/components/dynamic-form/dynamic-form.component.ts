import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FieldConfig } from '../../../core/models/field.interface';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DynamicFormFieldComponent } from '../dynamic-form-field/dynamic-form-field.component';

@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DynamicFormFieldComponent,
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

  @Output() formSubmit = new EventEmitter<any>();
  @Output() formCancel = new EventEmitter<void>();

  form!: FormGroup;

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

  getFieldCssClass(field: FieldConfig): string {
    if (field.cssClass) {
      switch (field.cssClass) {
        case 'colspan-third': return 'dynamic-form-field-third';
        case 'colspan-half': return 'dynamic-form-field-half';
        case 'colspan-full': return 'dynamic-form-field-full';
        default: return 'dynamic-form-field-full';
      }
    }

    const fullWidthTypes = ['textarea', 'select', 'select-multiple', 'checkbox', 'slide-toggle', 'tip', 'radio', 'section-header', 'icon-picker'];
    if (fullWidthTypes.includes(field.type)) return 'dynamic-form-field-full';

    const halfWidthTypes = ['datepicker', 'number'];
    if (halfWidthTypes.includes(field.type)) return 'dynamic-form-field-half';

    return 'dynamic-form-field-full';
  }

  submit() {
    if (this.form.valid) {
      this.formSubmit.emit(this.form.getRawValue());
    } else {
      this.form.markAllAsTouched();
    }
  }
}
