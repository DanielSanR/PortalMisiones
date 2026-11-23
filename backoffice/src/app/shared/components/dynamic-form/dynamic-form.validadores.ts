import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { FieldConfig, FieldValidations } from '@core/models/field.interface';

/** Validadores propios del motor de formularios (`DynamicFormComponent.getValidators`). */

/** `required` que no se conforma con espacios. */
export function requeridoConContenido(control: AbstractControl): ValidationErrors | null {
  return String(control.value ?? '').trim() ? null : { required: true };
}

/** `minlength` sobre el valor recortado ("a  " no son tres caracteres). Vacío: lo informa `required`. */
export function minimoRecortado(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const largo = String(control.value ?? '').trim().length;
    return largo > 0 && largo < min ? { minlength: { requiredLength: min, actualLength: largo } } : null;
  };
}

/** `FieldValidations.validar` como validador: el error `personalizado` lleva el mensaje. */
export function reglaPropia(validar: (valor: string) => string | null): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const mensaje = validar(String(control.value ?? ''));
    return mensaje ? { personalizado: mensaje } : null;
  };
}

/**
 * `FieldValidations.validarCon` como validador: lee los demás valores del grupo del control. Su error va en
 * `entreCampos` y no en el `personalizado` de `validar`: Angular fusiona los errores de los validadores por
 * clave, así que con la misma clave ganaría esta regla (va última). Con claves distintas conviven y
 * `FORM_ERROR_PRIORITY` muestra primero la del propio campo.
 */
export function reglaEntreCampos(validar: NonNullable<FieldValidations['validarCon']>['validar']): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valores: Record<string, unknown> = control.parent?.getRawValue() ?? {};
    const mensaje = validar(control.value, valores);
    return mensaje ? { entreCampos: mensaje } : null;
  };
}

/** Un valor que el backend rechazó al guardar (`setErrors({ server })`) y su mensaje. */
export interface RechazoDelServidor {
  valor: unknown;
  mensaje: unknown;
}

/**
 * El error `server` como validador, atado al valor rechazado: mientras el control tenga ESE valor, el error sigue
 * ahí aunque algo revalide el formulario (la página re-entrega `fields`, o se agrega un control y el
 * `FormGroupDirective` revalida todo el árbol). Cuando el valor cambia (la persona lo edita), el rechazo se olvida.
 * `rechazos` es del motor (`DynamicFormComponent`), que lo llena al recibir el error y lo vacía donde corresponde.
 */
export function reglaDeRechazo(rechazos: Map<string, RechazoDelServidor>, nombre: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const rechazo = rechazos.get(nombre);
    if (!rechazo) return null;
    if (control.value !== rechazo.valor) {
      rechazos.delete(nombre);
      return null;
    }
    return { server: rechazo.mensaje };
  };
}

/**
 * Tipos de texto libre: "obligatorio" y el mínimo se miden sobre el valor recortado, que es lo que
 * valida el backend (`@NotBlank`, `@Size(min)`): solo espacios no cuenta como completado.
 */
const TIPOS_DE_TEXTO_LIBRE = ['text', 'textarea'];

/**
 * Validadores de lo que la persona escribe o elige. Un campo `readonly` no lleva ninguno: no se puede editar,
 * así que un `required` (o un `pattern`…) sobre un valor que llegó vacío o inválido bloquearía el envío sin
 * forma de corregirlo ni de verlo (la vista de solo lectura no tiene `mat-error` ni marca de obligatorio).
 * Lo que viaja lo valida el backend. Ver `FieldConfig.readonly`.
 */
export function validadoresDe(field: FieldConfig): ValidatorFn[] {
  const validators: ValidatorFn[] = [];
  const reglas = field.validations;
  if (field.readonly || !reglas) return validators;
  const textoLibre = TIPOS_DE_TEXTO_LIBRE.includes(field.type);

  if (reglas.required) validators.push(textoLibre ? requeridoConContenido : Validators.required);
  if (reglas.maxLength) validators.push(Validators.maxLength(reglas.maxLength));
  if (reglas.minLength) validators.push(textoLibre ? minimoRecortado(reglas.minLength) : Validators.minLength(reglas.minLength));
  if (reglas.pattern) validators.push(Validators.pattern(reglas.pattern));
  if (reglas.email) validators.push(Validators.email);
  if (reglas.validar) validators.push(reglaPropia(reglas.validar));
  if (reglas.validarCon) validators.push(reglaEntreCampos(reglas.validarCon.validar));
  return validators;
}
