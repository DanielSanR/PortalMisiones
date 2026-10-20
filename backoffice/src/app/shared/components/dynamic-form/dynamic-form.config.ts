import { FieldConfig, FormConfig } from '../../../core/models/field.interface';
import { canonicalizarSlug } from '../../../core/utils/slug.utils';

const FORM_CONFIGS: Record<string, FormConfig> = {
  // Backend real (§5.2): Organism = typeId (req) + parentId? + baseLocationId? + name + acronym? + active.
  // Sin sitioWeb/logoUrl (no existen en el backend).
  ORGANISMO: {
    fields: [
      // Estructura del diseño "Pantallas · Backoffice Misiones", pantalla FORM.
      // Los campos marcados `pendiente` están en el diseño pero el backend no los
      // persiste (`OrganismRequestDTO` solo acepta typeId, parentId, baseLocationId,
      // name, acronym y active): van deshabilitados para que nadie escriba y pierda.
      {
        name: '_section_datos',
        label: 'Datos institucionales',
        type: 'section-header',
        placeholder: 'Identificación y jerarquía del organismo',
      },
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Nombre del organismo',
        cssClass: 'colspan-wide',
        validations: {
          required: true,
          maxLength: 255,
        },
      },
      {
        name: 'acronym',
        label: 'Sigla',
        type: 'text',
        placeholder: 'Ej: IPS',
        cssClass: 'colspan-third',
        validations: { maxLength: 50 },
      },
      {
        name: 'cuit',
        label: 'CUIT',
        type: 'text',
        placeholder: 'Ej. 30-67890123-4',
        cssClass: 'colspan-third',
        disabled: true,
        pendiente: true,
      },
      {
        name: 'typeId',
        label: 'Tipo de organismo',
        type: 'select',
        placeholder: 'Seleccione un tipo',
        cssClass: 'colspan-wide',
        validations: { required: true },
        options: [],
        // Es requerido y sin opción "ninguno": si no hay tipos cargados, el alta
        // queda trabada. El mensaje tiene que decir cómo destrabarla.
        emptyOptionsMessage: 'No hay tipos de organismo cargados. Creá uno primero en Tipos de organismo.',
      },
      {
        name: 'parentId',
        label: 'Organismo superior',
        type: 'select',
        placeholder: 'Sin organismo superior',
        cssClass: 'colspan-third',
        options: [],
      },
      {
        name: 'jurisdiccion',
        label: 'Jurisdicción',
        type: 'radio',
        cssClass: 'colspan-third',
        disabled: true,
        pendiente: true,
        options: [
          { id: 'provincial', name: 'Provincial' },
          { id: 'municipal', name: 'Municipal' },
        ],
      },
      {
        name: 'baseLocationId',
        label: 'Localidad base',
        type: 'select',
        placeholder: 'Sin localidad',
        hint: 'Localidad de referencia del organismo (opcional)',
        cssClass: 'colspan-half',
        options: [],
      },
      {
        name: 'descripcion',
        label: 'Descripción',
        type: 'textarea',
        placeholder: 'Se muestra en la ficha pública del organismo.',
        cssClass: 'colspan-full',
        disabled: true,
        pendiente: true,
        validations: { maxLength: 500 },
      },
      {
        name: 'activo',
        label: 'Organismo activo',
        type: 'checkbox',
        value: true,
      },

      {
        name: '_section_contacto',
        label: 'Contacto y visibilidad',
        type: 'section-header',
        placeholder: 'Datos que se publican en el portal ciudadano',
      },
      {
        name: 'domicilio',
        label: 'Domicilio',
        type: 'text',
        placeholder: 'Ej. Av. López y Planes 2760, Posadas',
        cssClass: 'colspan-wide',
        disabled: true,
        pendiente: true,
      },
      {
        name: 'telefono',
        label: 'Teléfono',
        type: 'text',
        placeholder: 'Ej. 376 444-7000',
        cssClass: 'colspan-third',
        disabled: true,
        pendiente: true,
      },
      {
        name: 'correo',
        label: 'Correo institucional',
        type: 'email',
        placeholder: 'Ej. contacto@salud.misiones.gob.ar',
        cssClass: 'colspan-third',
        disabled: true,
        pendiente: true,
      },
      {
        name: 'sitioWeb',
        label: 'Sitio web',
        type: 'url',
        placeholder: 'Ej. salud.misiones.gob.ar',
        cssClass: 'colspan-third',
        disabled: true,
        pendiente: true,
      },
      {
        name: 'visiblePortal',
        label: 'Visible en el portal ciudadano',
        type: 'checkbox',
        disabled: true,
        pendiente: true,
      },
      {
        name: 'destacado',
        label: 'Destacar en la página de inicio',
        type: 'checkbox',
        disabled: true,
        pendiente: true,
      },

    ],
    submitButtonText: 'Crear organismo',
    cancelButtonText: 'Cancelar',
  },

  // Backend real (§5.2): OrganismType = name (req) + description? + active.
  TIPO_ORGANISMO: {
    fields: [
      {
        name: '_section_datos',
        label: 'Datos del tipo de organismo',
        type: 'section-header',
      },
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Ej: Ministerio, Secretaría',
        cssClass: 'colspan-full',
        validations: { required: true, maxLength: 100 },
      },
      {
        name: 'descripcion',
        label: 'Descripción',
        type: 'textarea',
        placeholder: 'Descripción breve del tipo de organismo',
        cssClass: 'colspan-full',
      },
      {
        name: 'activo',
        label: 'Tipo activo',
        type: 'checkbox',
        value: true,
      },
    ],
    submitButtonText: 'Crear tipo',
    cancelButtonText: 'Cancelar',
  },
  ETIQUETA: {
    fields: [
      {
        name: '_section_datos',
        label: 'Datos de la etiqueta',
        type: 'section-header',
      },
      // Contrato real `Tag` (BACKEND_API_SPEC.md §5.5): solo `slug` + organismo opcional.
      // `local` no se pide: lo deriva el alcance (con organismo ⇒ local; sin ⇒ global).
      {
        name: 'slug',
        label: 'Slug',
        type: 'text',
        placeholder: 'Ej: salud, adultos-mayores',
        hint: 'Se guarda en minúsculas, sin tildes y con guiones en lugar de espacios.',
        // El backend canonicaliza (`TagService.createTag`): se muestra cómo va a quedar.
        preview: { label: 'Se guardará como:', transform: canonicalizarSlug },
        cssClass: 'colspan-half',
        validations: {
          required: true,
          maxLength: 100,
        },
      },
      {
        name: 'organismoId',
        label: 'Organismo',
        type: 'select',
        // Sin organismo ⇒ global; con organismo ⇒ local de ese organismo. La primera opción
        // ("Ninguno — etiqueta global") la agrega el form al cargar el catálogo.
        placeholder: 'Ninguno — etiqueta global',
        cssClass: 'colspan-half',
        options: [],
      },
    ],
    submitButtonText: 'Crear etiqueta',
    cancelButtonText: 'Cancelar',
  },

  // Backend real (post-pull): LifeEvent request = solo `name`; el `slug` lo genera el backend.
  EVENTO_DE_VIDA: {
    fields: [
      {
        name: '_section_datos',
        label: 'Datos del evento de vida',
        type: 'section-header',
      },
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Ej: Nacimiento de un hijo, Iniciar un emprendimiento',
        hint: 'El identificador (slug) se genera automáticamente desde el nombre.',
        // No hay campo `slug`: el backend lo deriva del `name` (`generateSlug`), así que la
        // vista previa va sobre el nombre y muestra el identificador resultante.
        preview: { label: 'Identificador (slug):', transform: canonicalizarSlug },
        cssClass: 'colspan-full',
        validations: {
          required: true,
          minLength: 3,
          maxLength: 100,
        },
      },
    ],
    submitButtonText: 'Crear evento de vida',
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

  // Backend real (§5.4): Recipient solo persiste `name`.
  DESTINATARIO: {
    fields: [
      {
        name: '_section_datos',
        label: 'Datos del destinatario',
        type: 'section-header',
      },
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Ej: persona_humana, empresa, extranjero',
        cssClass: 'colspan-full',
        validations: {
          required: true,
          minLength: 3,
          maxLength: 100,
        },
      },
    ],
    submitButtonText: 'Crear destinatario',
    cancelButtonText: 'Cancelar',
  },

  // Backend real (§5.3): Modality solo persiste `name`. Sin descripción/ícono/color.
  MODALIDAD: {
    fields: [
      {
        name: '_section_datos',
        label: 'Datos de la modalidad',
        type: 'section-header',
      },
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Ej: Digital de punta a punta',
        cssClass: 'colspan-full',
        validations: {
          required: true,
          minLength: 3,
          maxLength: 100,
        },
      },
    ],
    submitButtonText: 'Crear modalidad',
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
    // "no hay opciones" en vez de quedarse en "Cargando opciones...".
    field.optionsLoaded = true;
  }
  return clone;
}
