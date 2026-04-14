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
        cssClass: 'colspan-full',
        validations: {
          required: true,
          maxLength: 150,
        },
      },
      {
        name: 'descripcion',
        label: 'Descripción',
        type: 'textarea',
        placeholder: 'Breve descripción del evento y los trámites que agrupa',
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
        placeholder: 'Seleccione un ícono representativo del evento',
        cssClass: 'colspan-full',
      },
      {
        name: 'color',
        label: 'Color',
        type: 'text',
        placeholder: '#4CAF50',
        hint: 'Color hexadecimal para identificar el evento',
        cssClass: 'colspan-half',
      },
      {
        name: '_section_tramites',
        label: 'Trámites asociados',
        type: 'section-header',
      },
      {
        name: 'tramiteIds',
        label: 'Trámites',
        type: 'select-multiple',
        placeholder: 'Seleccione los trámites que pertenecen a este evento',
        cssClass: 'colspan-full',
        options: [],
      },
    ],
    submitButtonText: 'Crear evento de vida',
    cancelButtonText: 'Cancelar',
  },

  CATEGORIA: {
    fields: [
      { name: '_section_datos', label: 'Datos de la categoría', type: 'section-header' },
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Ej: Automotor, transporte y tránsito',
        cssClass: 'colspan-half',
        validations: { required: true, maxLength: 100 },
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
      {
        name: 'descripcion',
        label: 'Descripción',
        type: 'textarea',
        placeholder: 'Descripción breve de la categoría',
        cssClass: 'colspan-full',
      },
      {
        name: 'orden',
        label: 'Orden',
        type: 'number',
        placeholder: '1',
        cssClass: 'colspan-half',
        hint: 'Orden de aparición (menor = primero)',
      },
      { name: '_section_visual', label: 'Apariencia', type: 'section-header' },
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
        placeholder: '#1565C0',
        hint: 'Color hexadecimal',
        cssClass: 'colspan-half',
      },
    ],
    submitButtonText: 'Crear categoría',
    cancelButtonText: 'Cancelar',
  },

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
          maxLength: 100,
        },
      },
      {
        name: 'descripcion',
        label: 'Descripción',
        type: 'textarea',
        placeholder: 'Descripción breve de esta modalidad de trámite',
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
        hint: 'Color hexadecimal para identificar la modalidad',
        cssClass: 'colspan-half',
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
  }
  return clone;
}
