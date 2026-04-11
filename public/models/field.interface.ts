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
    | 'radio'
    | 'tip'
    | 'slide-toggle';
  placeholder?: string;
  hint?: string;
  cssClass?: 'colspan-full' | 'colspan-half' | 'colspan-third';
  disabled?: boolean;
  value?: any;
  options?: { id: any; name: string }[];
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
