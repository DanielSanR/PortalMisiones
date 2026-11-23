import { AbstractControl, FormGroup, ValidationErrors } from '@angular/forms';
import { FieldConfig } from '@core/models/field.interface';

/** Generadores de mensaje por clave de error de validación (es-AR). */
export const FORM_ERROR_MESSAGES: { [key: string]: (field: FieldConfig) => string } = {
  required: () => 'Este campo es obligatorio',
  requiredFile: () => 'Debe seleccionar un archivo',
  invalidFileType: () => 'Tipo de archivo no permitido. Tipos permitidos: .pdf',
  fileSizeExceeded: () => 'El archivo supera el tamaño máximo permitido de 10MB',
  invalidStartDateFormat: () => 'El formato de la fecha no es válido',
  invalidEndDateFormat: () => 'El formato de la fecha de fin no es válido',
  startBeforeToday: () => 'La fecha de inicio no puede ser anterior a hoy',
  endBeforeStart: () => 'La fecha de fin no puede ser anterior a la fecha de inicio',
  dateNotInFuture: () => 'La fecha debe ser mayor a la fecha actual',
  email: () => 'El email ingresado no es válido',
  minlength: (field) => `No debe ser menor a los ${field.validations?.minLength} caracteres`,
  maxlength: (field) => `No puede superar los ${field.validations?.maxLength} caracteres`,
  pattern: (field) => field.validations?.patternErrorMessage || 'El formato ingresado no es válido',
  matDatepickerParse: () => 'Por favor ingresá una fecha válida',
  // Validador propio del formulario a mano de la ficha (`ficha-form-campos.ts`).
  slugVacio: () => 'Tiene que tener letras o números',
};

/** Orden de prioridad: se muestra el primer error de esta lista presente en el control. */
export const FORM_ERROR_PRIORITY: string[] = [
  // Error que devolvió el backend para este campo (ej. unicidad). Su valor ES el mensaje.
  'server',
  // Antes que `required`: una fecha mal escrita deja el control en `null`, y "es obligatoria" no dice qué corregir.
  'matDatepickerParse',
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
  'pattern',
  // Regla propia del campo (`FieldValidations.validar`). Su valor ES el mensaje.
  'personalizado',
  // Regla entre campos (`FieldValidations.validarCon`), después de la del propio campo. Su valor ES el mensaje.
  'entreCampos',
  'slugVacio',
];

/** Errores cuyo valor ya es el texto a mostrar (lo escribió el backend traducido, o una regla del campo). */
const CLAVES_CON_MENSAJE = ['server', 'personalizado', 'entreCampos'];

/** Resuelve el mensaje de error (es-AR) del primer error con mayor prioridad, o `null` si no hay. */
export function getControlErrorMessage(
  control: AbstractControl | null | undefined,
  field: FieldConfig,
  extraErrors?: ValidationErrors | null,
): string | null {
  if (!control) return null;
  const errors = { ...(control.errors ?? {}), ...(extraErrors ?? {}) };
  // Después de los errores conocidos, los validadores propios de una pantalla: valen si el campo les
  // declara un texto en `validations.mensajes` (p. ej. `slugRepetido`, `rango`).
  const mensajes = field.validations?.mensajes;
  const errorKey = FORM_ERROR_PRIORITY.find((key) => key in errors)
    ?? Object.keys(errors).find((key) => !!mensajes?.[key]);
  if (errorKey && CLAVES_CON_MENSAJE.includes(errorKey) && typeof errors[errorKey] === 'string') {
    return errors[errorKey];
  }
  if (!errorKey) {
    return Object.keys(errors).length ? 'Este campo tiene un error' : null;
  }
  return mensajes?.[errorKey] ?? FORM_ERROR_MESSAGES[errorKey]?.(field) ?? 'Este campo tiene un error';
}

/** Lo mínimo que el resumen necesita de un campo: su control y cómo se llama en pantalla. */
export interface CampoDeResumen {
  name: string;
  label: string;
}

/**
 * Mensajes "Label (motivo)" del banner resumen: uno por cada campo de `campos` cuyo control está
 * inválido y tocado, en ese orden. Los controles que no existen o están deshabilitados no cuentan.
 *
 * `motivo` resuelve el texto de cada error: `app-dynamic-form` usa `getControlErrorMessage`; un
 * formulario a mano con validadores propios pasa el suyo. Si devuelve vacío, el campo no se lista.
 */
export function resumenDeErrores<T extends CampoDeResumen>(
  form: FormGroup,
  campos: readonly T[],
  motivo: (control: AbstractControl, campo: T) => string | null,
): string[] {
  return campos
    .map((campo) => {
      const control = form.get(campo.name);
      if (!control || !control.invalid || !control.touched) return null;
      const mensaje = motivo(control, campo);
      return mensaje ? `${campo.label} (${mensaje})` : null;
    })
    .filter((mensaje): mensaje is string => !!mensaje);
}
