export interface FieldConfig {
  name: string;
  label: string;
  type:
  | 'text'
  | 'number'
  | 'select'
  | 'textarea'
  | 'select-multiple'
  | 'checkbox'
  | 'radio'
  | 'datepicker'
  | 'url'
  | 'email'
  | 'password'
  | 'tip'
  | 'icon-picker'
  | 'section-header';
  placeholder?: string;
  hint?: string;
  cssClass?: 'colspan-full' | 'colspan-half' | 'colspan-third' | 'colspan-wide';
  disabled?: boolean;
  value?: unknown;
  options?: { id: string | number; name: string }[];
  /**
   * Marca que el catálogo del select ya se resolvió (lo setea `updateFormConfigOptions`).
   * Sin esto, un catálogo vacío es indistinguible de uno que todavía está cargando y el
   * select queda mostrando "Cargando opciones..." para siempre.
   */
  optionsLoaded?: boolean;
  /** Qué decirle al usuario si el catálogo llegó vacío (debería explicar cómo destrabarse). */
  emptyOptionsMessage?: string;
  /**
   * El campo está en el diseño pero el backend todavía no lo persiste. Se muestra
   * deshabilitado y con una marca visible: en un formulario, un campo editable que no
   * se guarda es peor que uno ausente, porque el usuario escribe y pierde lo que puso.
   */
  pendiente?: boolean;
  /**
   * Vista previa derivada del valor tipeado, debajo del campo (p. ej. el slug como lo
   * canonicaliza el backend). Solo se muestra si el valor transformado no está vacío y
   * difiere de lo tipeado. Pensado para campos de texto; `transform` debe ser pura.
   */
  preview?: FieldPreview;
  validations?: FieldValidations;
}

export interface FieldPreview {
  /** Texto que antecede al valor, p. ej. "Se guardará como:". */
  label: string;
  transform: (valor: string) => string;
}
 
export interface FieldValidations {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  email?: boolean;
  patternErrorMessage?: string;
}

export interface FormConfig {
  fields?: FieldConfig[];
  submitButtonText?: string;
  cancelButtonText?: string;
}
