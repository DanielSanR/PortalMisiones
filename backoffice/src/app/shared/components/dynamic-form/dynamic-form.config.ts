import { FieldConfig, FormConfig } from '../../../core/models/field.interface';

const FORM_CONFIGS: Record<string, FormConfig> = {
  TRAMITE: {
    fields: [
      {
        name: '_section_info',
        label: 'Información del trámite',
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
        name: 'descripcionLarga',
        label: 'Descripción completa',
        type: 'textarea',
        placeholder: 'Información detallada: a quién se dirige, requisitos, paso a paso...',
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
        name: 'etiquetaIds',
        label: 'Etiquetas',
        type: 'select-multiple',
        placeholder: 'Seleccione etiquetas',
        options: [],
      },
      {
        name: '_section_visibilidad',
        label: 'Visibilidad',
        type: 'section-header',
      },
      {
        name: 'destacado',
        label: 'Marcar como trámite destacado',
        type: 'checkbox',
        value: false,
      },
    ],
    submitButtonText: 'Crear trámite',
    cancelButtonText: 'Cancelar',
  },

  ORGANISMO: {
    fields: [
      {
        name: '_section_datos',
        label: 'Datos del organismo',
        type: 'section-header',
      },
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Nombre del organismo',
        validations: {
          required: true,
          maxLength: 255,
        },
      },
      {
        name: 'sigla',
        label: 'Sigla',
        type: 'text',
        placeholder: 'Ej: IPS',
        cssClass: 'colspan-half',
      },
      {
        name: 'sitioWeb',
        label: 'Sitio web',
        type: 'url',
        placeholder: 'https://...',
        cssClass: 'colspan-half',
      },
      {
        name: '_section_web',
        label: 'Presencia web',
        type: 'section-header',
      },
      {
        name: 'logoUrl',
        label: 'URL del logo',
        type: 'url',
        placeholder: 'https://...',
      },
      {
        name: 'parentId',
        label: 'Organismo padre',
        type: 'select',
        placeholder: 'Ninguno (raíz)',
        options: [],
      },
    ],
    submitButtonText: 'Crear organismo',
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
  }
  return clone;
}
