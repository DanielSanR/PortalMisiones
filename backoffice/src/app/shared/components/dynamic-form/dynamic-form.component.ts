import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FieldConfig } from '../../../core/models/field.interface';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DynamicFormFieldComponent } from '../dynamic-form-field/dynamic-form-field.component';
import { FormErrorBannerComponent } from '../form-error-banner/form-error-banner.component';
import { getControlErrorMessage } from '../dynamic-form-field/form-error-messages.util';

/** Tipos de campo sin control reactivo propio ni label overline externo. */
const NO_EXTERNAL_LABEL_TYPES = ['tip', 'section-header', 'checkbox'];

/** Tipos de campo puramente visuales: no tienen control en el `FormGroup`. */
const NO_CONTROL_TYPES = ['tip', 'section-header'];

@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    DynamicFormFieldComponent,
    FormErrorBannerComponent,
  ],
  templateUrl: './dynamic-form.component.html',
  styleUrls: ['./dynamic-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicFormComponent implements OnInit, OnChanges {
  @Input() fields: FieldConfig[] = [];
  @Input() submitButtonText = 'Guardar';
  /** Texto del botón mientras `saving` (se conserva junto al spinner). */
  @Input() savingButtonText = 'Guardando…';
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
  /**
   * Se incrementa al enviar: `markAllAsTouched()` no emite eventos ni cambia inputs, así que los
   * campos (OnPush) no se revisarían y sus errores no aparecerían. Viaja como `[revision]`.
   */
  revision = 0;

  /** Banner de resumen de validación: se enfoca al enviar un formulario inválido. */
  @ViewChild(FormErrorBannerComponent) private resumen?: FormErrorBannerComponent;

  constructor(private fb: FormBuilder, private cdr: ChangeDetectorRef) {}

  /** "Guardar" bloqueado porque es edición sin cambios (`requireChanges`). */
  get sinCambios(): boolean {
    return this.requireChanges && !!this.form?.pristine;
  }

  ngOnInit() {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Antes de `ngOnInit` (primer cambio) el form todavía no existe: lo arma `initForm`.
    if (!this.form) return;

    if (changes['fields']) {
      this.syncControls();
    }
    if (changes['initialData'] && changes['initialData'].currentValue) {
      this.applyInitialData(changes['initialData'].currentValue);
    }
  }

  /** `trackBy` del `*ngFor`: sin esto, cada `fields` nuevo recrea el DOM y se pierde el foco. */
  trackByName(_index: number, field: FieldConfig): string {
    return field.name;
  }

  private initForm() {
    const group = this.fb.group({});

    this.fields.forEach(field => {
      if (NO_CONTROL_TYPES.includes(field.type)) return;
      group.addControl(field.name, this.createControl(field));
    });

    this.form = group;
    this.form.markAsPristine();
  }

  private createControl(field: FieldConfig) {
    const initialValue = this.initialData?.[field.name] ?? field.value ?? '';
    return this.fb.control({ value: initialValue, disabled: !!field.disabled }, this.getValidators(field));
  }

  /**
   * Reconciliación de controles cuando cambia `fields` después del primer render (típicamente
   * `updateFormConfigOptions` al llegar un catálogo async). Antes se rehacía el `FormGroup`
   * entero y se perdía lo tipeado —más el estado dirty/touched— mientras cargaban las opciones.
   * Ahora se conserva el mismo grupo y los mismos controles: solo se agregan los de campos
   * nuevos, se quitan los que ya no están y se actualizan validadores y `disabled`. Nada de
   * esto cambia el valor ni marca dirty, así que `requireChanges` y el guard no se ven afectados.
   */
  private syncControls() {
    const conControl = this.fields.filter((field) => !NO_CONTROL_TYPES.includes(field.type));
    const nombres = new Set(conControl.map((field) => field.name));

    Object.keys(this.form.controls)
      .filter((nombre) => !nombres.has(nombre))
      .forEach((nombre) => this.form.removeControl(nombre, { emitEvent: false }));

    conControl.forEach((field) => {
      const control = this.form.get(field.name);
      if (!control) {
        this.form.addControl(field.name, this.createControl(field), { emitEvent: false });
        return;
      }
      control.setValidators(this.getValidators(field));
      if (field.disabled && control.enabled) control.disable({ emitEvent: false });
      if (!field.disabled && control.disabled) control.enable({ emitEvent: false });
      control.updateValueAndValidity({ emitEvent: false });
    });
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * Precarga lo que trae `initialData` y deja pristine solo esos controles: un `initialData`
   * parcial (p. ej. el padre preseleccionado en un alta) no debe borrar el dirty de lo que el
   * usuario ya escribió en los demás campos.
   */
  private applyInitialData(data: Record<string, unknown>) {
    this.form.patchValue(data);
    Object.keys(data).forEach((nombre) => this.form.get(nombre)?.markAsPristine());
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
      this.revision++;
      // Render del banner y recién después el foco (sin esto `focus()` corre con el banner aún ausente).
      this.cdr.detectChanges();
      this.resumen?.focus();
    }
  }
}
