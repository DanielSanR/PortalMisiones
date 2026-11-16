import { FieldConfig, FormConfig, TreeFieldConfig } from '../../../core/models/field.interface';
import { canonicalizarSlug } from '../../../core/utils/slug.utils';

const FORM_CONFIGS: Record<string, FormConfig> = {
  // Backend real (§5.2): Organism = typeId (req) + parentId? + baseLocationId? + name + acronym? + active.
  // Sin sitioWeb/logoUrl (no existen en el backend).
  ORGANISMO: {
    fields: [
      // Diseño "Pantallas · Backoffice Misiones", ficha de organismo en modo edición / alta.
      // Solo lo que `OrganismRequestDTO` persiste. El título de la sección lo pone la tarjeta
      // "Datos institucionales" de la ficha, por eso acá no hay `section-header`.
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Ej. Ministerio de Salud Pública',
        cssClass: 'colspan-full',
        validations: {
          required: true,
          maxLength: 255,
        },
      },
      {
        name: 'acronym',
        label: 'Sigla',
        type: 'text',
        placeholder: 'Ej. MSP',
        hint: 'Opcional. No puede repetirse entre organismos.',
        cssClass: 'colspan-half',
        validations: { maxLength: 50 },
      },
      {
        name: 'typeId',
        label: 'Tipo de organismo',
        type: 'select',
        placeholder: 'Seleccioná un tipo',
        cssClass: 'colspan-half',
        validations: { required: true },
        options: [],
        // Es requerido y sin opción "ninguno": si no hay tipos cargados, el alta
        // queda trabada. El mensaje tiene que decir cómo destrabarla.
        emptyOptionsMessage: 'No hay tipos de organismo cargados. Creá uno primero en Tipos de organismo.',
      },
      {
        // El árbol (`tree.nodes`) lo arma la ficha con los organismos y sus motivos de bloqueo.
        name: 'parentId',
        label: 'Organismo superior',
        type: 'tree-select',
        hint: 'Opcional. De quién depende en la estructura.',
        cssClass: 'colspan-half',
        tree: {
          nodes: [],
          emptyLabel: 'Sin organismo superior',
          emptyMeta: 'Queda como organismo raíz',
          searchLabel: 'Buscar por nombre o sigla',
        },
      },
      {
        name: 'baseLocationId',
        label: 'Localidad base',
        type: 'select',
        placeholder: 'Sin localidad',
        hint: 'Opcional. Localidad de referencia del organismo.',
        cssClass: 'colspan-half',
        options: [],
      },
      {
        name: 'activo',
        label: 'Organismo activo',
        type: 'checkbox',
        hint: 'Un organismo inactivo no se puede elegir como organismo superior de otro.',
        value: true,
      },
    ],
    submitButtonText: 'Crear organismo',
    cancelButtonText: 'Cancelar',
  },

  // Backend real (§5.3): Category persiste `parentId?` + `slug` + `name`. Sin descripción/orden/ícono/color.
  CATEGORIA: {
    fields: [
      { name: '_section_datos', label: 'Datos de la categoría', type: 'section-header' },
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Ej: Automotor, transporte y tránsito',
        cssClass: 'colspan-half',
        validations: { required: true, minLength: 3, maxLength: 100 },
      },
      {
        name: 'slug',
        label: 'Slug',
        type: 'text',
        placeholder: 'Ej: automotor-transporte',
        hint: 'Identificador URL único (minúsculas, números y guiones)',
        // Categoría NO canonicaliza en el backend (el slug viaja tal cual y lo filtra el
        // `pattern`), así que no es "se guardará como" sino la forma válida sugerida.
        preview: { label: 'Formato sugerido:', transform: canonicalizarSlug },
        cssClass: 'colspan-half',
        validations: {
          required: true,
          minLength: 3,
          maxLength: 100,
          pattern: '^[a-z0-9-]+$',
          patternErrorMessage: 'Solo minúsculas, números y guiones',
        },
      },
      {
        name: 'parentId',
        label: 'Categoría padre',
        type: 'select',
        placeholder: 'Seleccione categoría padre',
        cssClass: 'colspan-half',
        hint: 'Dejar vacío para crear una categoría raíz (nivel 1)',
        options: [],
      },
    ],
    submitButtonText: 'Crear categoría',
    cancelButtonText: 'Cancelar',
  },

  // Backend real (`CreateUserRequest`): email 5–50, password 8–20, role (UUID), organizationId? y
  // profileDto {firstName, lastName}. La página (`usuario-form`) quita lo que no aplica: contraseña y
  // estado en edición, y `organismoId` cuando el rol elegido no es de scope `organismo`.
  USUARIO: {
    fields: [
      { name: '_section_datos', label: 'Datos personales', type: 'section-header' },
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Ej: María',
        cssClass: 'colspan-half',
        validations: { required: true, maxLength: 100 },
      },
      {
        name: 'apellido',
        label: 'Apellido',
        type: 'text',
        placeholder: 'Ej: González',
        cssClass: 'colspan-half',
        validations: { required: true, maxLength: 100 },
      },

      { name: '_section_acceso', label: 'Acceso', type: 'section-header' },
      {
        name: 'email',
        label: 'Email',
        type: 'email',
        placeholder: 'usuario@misiones.gob.ar',
        cssClass: 'colspan-half',
        validations: { required: true, email: true, maxLength: 50 },
      },
      {
        name: 'password',
        label: 'Contraseña',
        type: 'password',
        placeholder: 'Entre 8 y 20 caracteres',
        cssClass: 'colspan-half',
        validations: { required: true, minLength: 8, maxLength: 20 },
      },

      { name: '_section_rol', label: 'Rol y ubicación', type: 'section-header' },
      {
        name: 'rol',
        label: 'Rol',
        type: 'select',
        placeholder: 'Seleccioná un rol',
        hint: 'Define qué puede ver y hacer dentro del backoffice',
        // Ancho completo: Organismo solo aparece con algunos roles, y a media fila Rol quedaba con un hueco al lado.
        cssClass: 'colspan-full',
        validations: { required: true },
        options: [],
        emptyOptionsMessage: 'No hay roles que puedas asignar.',
      },
      {
        name: 'organismoId',
        label: 'Organismo',
        type: 'select',
        placeholder: 'Seleccioná un organismo',
        hint: 'Obligatorio para este rol: sus permisos valen dentro de un organismo',
        cssClass: 'colspan-full',
        validations: { required: true },
        options: [],
        emptyOptionsMessage: 'No hay organismos activos. Creá uno primero en Organismos.',
      },

      { name: '_section_estado', label: 'Estado', type: 'section-header' },
      {
        name: 'activo',
        label: 'Activar la cuenta al crear',
        type: 'checkbox',
        value: false,
      },
    ],
    submitButtonText: 'Crear usuario',
    cancelButtonText: 'Cancelar',
  },
};

/**
 * Copia profunda que preserva funciones por referencia.
 *
 * Los FormConfig se clonan para que un formulario no mute la config compartida de
 * `FORM_CONFIGS` (p. ej. al cargar `options`). `structuredClone` no sirve: tira
 * `DataCloneError` ante funciones, y la config las lleva (`FieldConfig.preview.transform`).
 * Las funciones son puras e inmutables, así que compartirlas no rompe el aislamiento;
 * todo lo demás (arrays y objetos planos) se copia en profundidad.
 */
function clonarConfig<T>(valor: T): T {
  if (valor === null || typeof valor !== 'object') {
    // primitivos y funciones: se devuelven tal cual
    return valor;
  }
  if (Array.isArray(valor)) {
    return valor.map((item) => clonarConfig(item)) as T;
  }
  const proto = Object.getPrototypeOf(valor);
  if (proto !== Object.prototype && proto !== null) {
    // Date, Map, etc.: no llevan funciones adentro, structuredClone los copia bien
    return structuredClone(valor);
  }
  const copia: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    copia[clave] = clonarConfig(v);
  }
  return copia as T;
}

/**
 * Devuelve una copia profunda del FormConfig para la key dada.
 */
export function getFormConfig(key: string): FormConfig {
  const config = FORM_CONFIGS[key];
  if (!config) {
    throw new Error(`FormConfig '${key}' no encontrado`);
  }
  return clonarConfig(config);
}

/**
 * Devuelve un nuevo FormConfig con las options del campo indicado actualizadas.
 */
/**
 * Devuelve una copia del FormConfig con la jerarquía de un campo `tree-select` resuelta
 * (nodos + la entidad en edición). Los textos del campo se conservan de la config base.
 */
export function updateFormConfigTree(
  config: FormConfig,
  fieldName: string,
  tree: Pick<TreeFieldConfig, 'nodes' | 'self'>,
): FormConfig {
  const clone = clonarConfig(config);
  const field = clone.fields?.find((f: FieldConfig) => f.name === fieldName);
  if (field?.tree) {
    field.tree = { ...field.tree, ...tree, loaded: true };
  }
  return clone;
}

export function updateFormConfigOptions(
  config: FormConfig,
  fieldName: string,
  options: { id: any; name: string }[],
): FormConfig {
  const clone = clonarConfig(config);
  const field = clone.fields?.find((f: FieldConfig) => f.name === fieldName);
  if (field) {
    field.options = options;
    // Aunque `options` venga vacío: el catálogo se resolvió, y el select debe decir
    // "no hay opciones" en vez de quedarse en "Cargando opciones…".
    field.optionsLoaded = true;
  }
  return clone;
}
