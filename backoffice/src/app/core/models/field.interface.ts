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
  | 'datepicker'
  | 'url'
  | 'email'
  | 'password'
  | 'tip'
  | 'icon-picker'
  | 'section-header';
  placeholder?: string;
  hint?: string;
  cssClass?: 'colspan-full' | 'colspan-half' | 'colspan-third';
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
  validations?: FieldValidations;
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
