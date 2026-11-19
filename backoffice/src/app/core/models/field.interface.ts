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
  | 'section-header'
  /** Desplegable con árbol y buscador para elegir un nodo de una jerarquía (ver `tree`). */
  | 'tree-select'
  /**
   * Control en el `FormGroup` sin nada dibujado por el formulario: el widget lo pone la página,
   * proyectado dentro de `<app-dynamic-form>` (queda entre los campos y los botones), y escribe
   * el valor en `form.get(name)`. Así un widget propio (p. ej. la grilla de permisos de un rol)
   * participa de `requireChanges`, del guard de cambios sin guardar y del valor enviado.
   */
  | 'custom';
  placeholder?: string;
  hint?: string;
  cssClass?: 'colspan-full' | 'colspan-half' | 'colspan-third' | 'colspan-wide';
  disabled?: boolean;
  /**
   * Dato fijado que la persona no elige (p. ej. el organismo que impone su sesión). A diferencia de
   * `disabled`, el campo sigue en el orden de tabulación: se dibuja como un `<input readonly>` con el
   * valor legible (en un `select`, el nombre de la opción elegida), el `hint` —que acá es el MOTIVO—
   * queda asociado por `aria-describedby`, y no lleva la marca de obligatorio. El control sigue
   * habilitado: su valor (`value` / `initialData`) viaja en `form.value` como el de cualquier otro.
   * Vale para cualquier tipo con control; preferirlo a `disabled` siempre que haya un motivo que contar.
   *
   * Sus `validations` NO se aplican mientras sea de solo lectura (`DynamicFormComponent.getValidators`): son
   * reglas sobre lo que la persona ingresa, y acá no puede ingresar nada. Un `required` sobre un valor que
   * llegó vacío dejaría el envío bloqueado sin error visible ni forma de corregirlo. Si el dato fijado es
   * indispensable, quien arma el campo tiene que garantizarlo (o no ofrecer el formulario); el backend lo
   * valida igual. Si el campo deja de ser `readonly`, sus validaciones vuelven a regir.
   */
  readonly?: boolean;
  /** El valor es un identificador técnico (`CREATE_PROCEDURE`): se escribe en monoespaciada. Solo `text`. */
  mono?: boolean;
  value?: unknown;
  options?: { id: string | number; name: string }[];
  /**
   * Marca que el catálogo del select ya se resolvió (lo setea `updateFormConfigOptions`).
   * Sin esto, un catálogo vacío es indistinguible de uno que todavía está cargando y el
   * select queda mostrando "Cargando opciones…" para siempre.
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
  /** Jerarquía y textos de un campo `tree-select`. */
  tree?: TreeFieldConfig;
  validations?: FieldValidations;
}

/** Un nodo elegible (o visible pero no elegible) de un campo `tree-select`. */
export interface TreeOption {
  id: string;
  label: string;
  /** Dato secundario bajo el nombre (p. ej. el tipo de organismo). */
  meta?: string;
  /** `null` = raíz. Un padre que no está en la lista también se trata como raíz. */
  parentId: string | null;
  /** Texto de búsqueda adicional al `label` (p. ej. la sigla). */
  keywords?: string;
  /**
   * Por qué no se puede elegir. El nodo se muestra igual, con este motivo a la vista: ocultarlo
   * deja al usuario buscando algo que "debería estar".
   */
  disabledReason?: string;
}

export interface TreeFieldConfig {
  nodes: TreeOption[];
  /** Marca que el catálogo ya se resolvió (mismo criterio que `optionsLoaded`). */
  loaded?: boolean;
  /** Texto de la opción "ninguno" y del control cuando no hay nada elegido. */
  emptyLabel: string;
  /** Aclaración bajo la opción "ninguno" (p. ej. "Queda como organismo raíz"). */
  emptyMeta?: string;
  searchLabel: string;
  /**
   * La entidad que se está cargando o editando: se dibuja debajo del nodo elegido, para que se
   * vea dónde queda. `id` es el suyo cuando ya existe (sus hijos cuelgan de ella); `null` en un alta.
   */
  self?: { id: string | null; label: string; tag: string; /** Ícono Phosphor (sin `ph-`). Default: `buildings`. */ icon?: string };
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
  /**
   * Texto propio para un error de este campo, por clave de error (`required`, `minlength`, `maxlength`,
   * `email`, `pattern`…): "El nombre es obligatorio" en vez del genérico "Este campo es obligatorio".
   * Lo que no se declara acá usa el mensaje común de `form-error-messages.util`.
   */
  mensajes?: Record<string, string>;
  /**
   * Regla propia del campo que las demás no cubren (p. ej. "el slug que sale del nombre es muy corto").
   * Recibe el valor como texto y devuelve el mensaje a mostrar, o `null` si está bien. Debe ser pura y
   * mirar solo ESTE valor: no se vuelve a evaluar cuando cambia otro campo.
   */
  validar?: (valor: string) => string | null;
}

export interface FormConfig {
  fields?: FieldConfig[];
  submitButtonText?: string;
  cancelButtonText?: string;
}
