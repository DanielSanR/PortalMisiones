import { FieldConfig, FormConfig } from '../../../core/models/field.interface';

const FORM_CONFIGS: Record<string, FormConfig> = {
  TRAMITE: {
    fields: [
      // ── Tab 1: Datos Generales ───────────────────────────
      {
        name: '_section_info',
        label: 'Datos generales',
        type: 'section-header',
      },
      {
        name: 'titulo',
        label: 'Título del trámite',
        type: 'text',
        placeholder: 'Ej: Obtener certificado de residencia',
        hint: 'Debe comenzar con un verbo en infinitivo',
        cssClass: 'colspan-full',
        validations: {
          required: true,
          maxLength: 255,
        },
      },
      {
        name: 'resumen',
        label: 'Resumen',
        type: 'textarea',
        placeholder: 'Descripción breve para el listado',
        validations: {
          required: true,
        },
      },
      {
        name: 'urlOficial',
        label: 'URL oficial del trámite',
        type: 'url',
        placeholder: 'https://...',
        validations: {
          required: true,
        },
      },
      {
        name: 'icono',
        label: 'Ícono del trámite',
        type: 'icon-picker',
        placeholder: 'Seleccione un ícono para el portal',
        cssClass: 'colspan-full',
        validations: {
          required: true,
        },
      },
      {
        name: '_section_clasificacion',
        label: 'Clasificación',
        type: 'section-header',
      },
      {
        name: 'organismoId',
        label: 'Organismo',
        type: 'select',
        placeholder: 'Seleccione un organismo',
        cssClass: 'colspan-half',
        validations: {
          required: true,
        },
        options: [],
      },
      {
        name: 'modalidadId',
        label: 'Modalidad',
        type: 'select',
        placeholder: 'Seleccione una modalidad',
        cssClass: 'colspan-half',
        validations: {
          required: true,
        },
        options: [],
      },
      {
        name: 'categoriaIds',
        label: 'Categorías',
        type: 'select-multiple',
        placeholder: 'Seleccione las categorías (sub-categorías)',
        hint: 'Donde aparecerá el trámite en la navegación del portal.',
        options: [],
      },
      {
        name: 'etiquetaIds',
        label: 'Etiquetas',
        type: 'select-multiple',
        placeholder: 'Seleccione etiquetas (filtros transversales)',
        hint: 'Chips para filtrado cruzado entre categorías.',
        options: [],
      },
      {
        name: 'destinatarioIds',
        label: 'Destinatarios',
        type: 'select-multiple',
        placeholder: 'Seleccione los destinatarios',
        hint: 'Público objetivo: Ciudadanía, Organizaciones, Organismos.',
        options: [],
      },
      {
        name: '_section_disponibilidad',
        label: 'Disponibilidad',
        type: 'section-header',
      },
      {
        name: 'eventoDeVidaIds',
        label: 'Eventos de Vida',
        type: 'select-multiple',
        placeholder: 'Seleccioná los eventos de vida relacionados',
        hint: 'Los ciudadanos encuentran este trámite al explorar estos eventos.',
        cssClass: 'colspan-full',
        options: [],
      },
      {
        name: 'localidadIds',
        label: 'Localidades',
        type: 'select-multiple',
        placeholder: 'Dejar vacío para disponibilidad provincial',
        hint: 'Si no selecciona ninguna, el trámite estará disponible en toda la provincia.',
        cssClass: 'colspan-full',
        options: [],
      },
      {
        name: 'destacado',
        label: 'Marcar como trámite destacado',
        type: 'checkbox',
        value: false,
      },
      // ── Tab 2: Contenido Provincial ──────────────────────
      {
        name: '_section_contenido',
        label: 'Contenido provincial (igual para toda la provincia)',
        type: 'section-header',
      },
      {
        name: 'descripcionLarga',
        label: 'Descripción completa',
        type: 'textarea',
        placeholder: 'Información detallada: a quién se dirige, paso a paso...',
        cssClass: 'colspan-full',
      },
      {
        name: 'requisitos',
        label: 'Guía de Requisitos Generales',
        type: 'textarea',
        placeholder: 'Listar los requisitos necesarios para realizar el trámite',
        cssClass: 'colspan-full',
      },
      {
        name: 'costos',
        label: 'Costos y modalidad de pago (default provincial)',
        type: 'textarea',
        placeholder: 'Costos generales. Se puede personalizar por localidad.',
        hint: 'Este valor se usa como fallback cuando una localidad no tiene costo específico.',
      },
      {
        name: 'formularios',
        label: 'Formularios e instructivos',
        type: 'textarea',
        placeholder: 'Links a formularios PDF, instructivos, etc.',
      },
      {
        name: 'contacto',
        label: 'Contacto (default provincial)',
        type: 'textarea',
        placeholder: 'Dirección, teléfono, email de contacto general.',
        hint: 'Se puede personalizar por localidad.',
      },
      {
        name: 'sitioWebTramite',
        label: 'Sitio web del trámite',
        type: 'url',
        placeholder: 'https://...',
        hint: 'Página específica del trámite en el sitio del organismo.',
      },
      // Nota: Tab 3 (contenido por localidad) se maneja fuera del DynamicForm
    ],
    submitButtonText: 'Crear trámite',
    cancelButtonText: 'Cancelar',
  },

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
        cssClass: 'colspan-half',
        validations: {
          required: true,
          maxLength: 255,
        },
      },
      {
        name: 'acronym',
        label: 'Acrónimo',
        type: 'text',
        placeholder: 'Ej: IPS',
        cssClass: 'colspan-half',
        validations: { maxLength: 50 },
      },
      {
        name: 'typeId',
        label: 'Tipo de organismo',
        type: 'select',
        placeholder: 'Seleccione un tipo',
        cssClass: 'colspan-half',
        validations: { required: true },
        options: [],
        // Es requerido y sin opción "ninguno": si no hay tipos cargados, el alta
        // queda trabada. El mensaje tiene que decir cómo destrabarla.
        emptyOptionsMessage: 'No hay tipos de organismo cargados. Creá uno primero en Tipos de organismo.',
      },
      {
        name: 'parentId',
        label: 'Organismo padre',
        type: 'select',
        placeholder: 'Ninguno (raíz)',
        cssClass: 'colspan-half',
        options: [],
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
        name: 'cuit',
        label: 'CUIT',
        type: 'text',
        placeholder: 'Ej. 30-67890123-4',
        cssClass: 'colspan-half',
        disabled: true,
        pendiente: true,
      },
      {
        name: 'jurisdiccion',
        label: 'Jurisdicción',
        type: 'select',
        placeholder: 'Provincial',
        cssClass: 'colspan-half',
        disabled: true,
        pendiente: true,
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
        cssClass: 'colspan-half',
        disabled: true,
        pendiente: true,
      },
      {
        name: 'telefono',
        label: 'Teléfono',
        type: 'text',
        placeholder: 'Ej. 376 444-7000',
        cssClass: 'colspan-half',
        disabled: true,
        pendiente: true,
      },
      {
        name: 'correo',
        label: 'Correo institucional',
        type: 'email',
        placeholder: 'Ej. contacto@salud.misiones.gob.ar',
        cssClass: 'colspan-half',
        disabled: true,
        pendiente: true,
      },
      {
        name: 'sitioWeb',
        label: 'Sitio web',
        type: 'url',
        placeholder: 'Ej. salud.misiones.gob.ar',
        cssClass: 'colspan-half',
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
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Ej: Salud, Educación, Empresas',
        cssClass: 'colspan-half',
        validations: {
          required: true,
          maxLength: 100,
        },
      },
      {
        name: '_section_visual',
        label: 'Apariencia',
        type: 'section-header',
      },
      {
        name: 'icono',
        label: 'Ícono',
        type: 'icon-picker',
        placeholder: 'Seleccione un ícono',
        cssClass: 'colspan-full',
      },
      {
        name: 'color',
        label: 'Color',
        type: 'text',
        placeholder: '#4CAF50',
        hint: 'Color hexadecimal para identificar la etiqueta',
        cssClass: 'colspan-half',
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
 * Devuelve una copia profunda del FormConfig para la key dada.
 */
export function getFormConfig(key: string): FormConfig {
  const config = FORM_CONFIGS[key];
  if (!config) {
    throw new Error(`FormConfig '${key}' no encontrado`);
  }
  return structuredClone(config);
}

/**
 * Devuelve un nuevo FormConfig con las options del campo indicado actualizadas.
 */
export function updateFormConfigOptions(
  config: FormConfig,
  fieldName: string,
  options: { id: any; name: string }[],
): FormConfig {
  const clone = structuredClone(config);
  const field = clone.fields?.find((f: FieldConfig) => f.name === fieldName);
  if (field) {
    field.options = options;
    // Aunque `options` venga vacío: el catálogo se resolvió, y el select debe decir
    // "no hay opciones" en vez de quedarse en "Cargando opciones...".
    field.optionsLoaded = true;
  }
  return clone;
}
