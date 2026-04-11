import { Directive, Input, OnChanges, SimpleChanges, ElementRef, Renderer2, OnDestroy } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { FieldConfig } from '../../../core/models/field.interface';
import { Subscription } from 'rxjs';

@Directive({
  selector: '[appFormErrorMessage]',
  standalone: true,
})
export class FormErrorMessageDirective implements OnChanges, OnDestroy {
  @Input() control: AbstractControl | null = null;
  @Input() field: FieldConfig | null = null;
  @Input() group: FormGroup | null = null;

  private subscription: Subscription | null = null;
  private errorMessages: { [key: string]: (field: FieldConfig) => string } = {
    required: () => '* Este campo es requerido.',
    requiredFile: () => 'Debe seleccionar un archivo.',
    invalidFileType: () => {
      const allowedTypes = ['.pdf'];
      return `Tipo de archivo no permitido. Tipos permitidos: ${allowedTypes.join(', ')}.`;
    },
    fileSizeExceeded: () => 'El archivo supera el tamaño máximo permitido de 10MB.',
    invalidStartDateFormat: () => 'El formato de la fecha no es válido.',
    invalidEndDateFormat: () => 'El formato de la fecha de fin no es válido.',
    startBeforeToday: () => 'La fecha de inicio no puede ser anterior a hoy.',
    endBeforeStart: () => 'La fecha de fin no puede ser anterior a la fecha de inicio.',
    dateNotInFuture: () => 'La fecha debe ser mayor a la fecha actual.',
    email: () => 'El email ingresado no es válido.',
    minlength: (field) =>
      `El campo no debe ser menor a los ${field.validations?.minLength} caracteres.`,
    maxlength: (field) =>
      `El campo no puede superar los ${field.validations?.maxLength} caracteres.`,
    min: (field) => `El valor no puede ser menor a ${field.validations?.min}.`,
    max: (field) => `El valor no puede superar ${field.validations?.max}.`,
    pattern: (field) =>
      field.validations?.patternErrorMessage || 'El formato ingresado no es válido.',
    matDatepickerParse: () => 'Por favor ingrese una fecha válida',
  };
  private errorPriority: string[] = [
    'required',
    'requiredFile',
    'invalidFileType',
    'fileSizeExceeded',
    'startBeforeToday',
    'endBeforeStart',
    'dateNotInFuture',
    'invalidStartDateFormat',
    'invalidEndDateFormat',
    'email',
    'minlength',
    'maxlength',
    'min',
    'max',
    'pattern',
    'matDatepickerParse',
  ];
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

    let errors = this.control.errors ?? {};
    if ((this.field.name === 'startDate' || this.field.name === 'endDate') && this.group && this.group.errors) {
      errors = { ...errors, ...this.group.errors };
    }

    if (Object.keys(errors).length === 0 && !this.control.invalid) {
      return;
    }

    const errorKey = this.errorPriority.find((key) => key in errors);
    if (!errorKey) {
      this.renderer.setProperty(this.el.nativeElement, 'innerHTML', 'Este campo tiene un error.');
      return;
    }

    const messageGenerator = this.errorMessages[errorKey];
    if (messageGenerator) {
      const message = messageGenerator(this.field);
      this.renderer.setProperty(this.el.nativeElement, 'innerHTML', message);
    } else {
      this.renderer.setProperty(this.el.nativeElement, 'innerHTML', 'Este campo tiene un error.');
    }
  }
}