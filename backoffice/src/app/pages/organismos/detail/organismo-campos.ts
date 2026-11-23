import { FormConfig, TreeOption } from '@core/models/field.interface';
import { OrganismoFormValue, OrganismoVM } from '@features/organismos';
import { updateFormConfigOptions, updateFormConfigTree } from '@shared/components/dynamic-form/dynamic-form.config';

/**
 * Campos del formulario de organismo (ficha en modo edición / alta). Devuelve una config nueva en cada
 * llamada: la ficha le carga los catálogos (`updateFormConfigOptions` / `updateFormConfigTree`).
 *
 * Backend real (§5.2): Organism = typeId (req) + parentId? + baseLocationId? + name + acronym? + active.
 * Sin sitioWeb/logoUrl (no existen en el backend).
 */
export function camposDeOrganismo(): FormConfig {
  return {
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
  };
}

/** Lo que entrega `OrganismosFacade.getFormData`: los catálogos y, si hay id, el organismo. */
export interface DatosDeOrganismo {
  tipos: { id: string; nombre: string }[];
  localidades: { id: string; nombre: string }[];
  organismos: OrganismoVM[];
  organismo: OrganismoVM | null;
}

/** La config con los catálogos cargados. `id` es el organismo en edición (`''` en el alta). */
export function camposConCatalogos(config: FormConfig, datos: DatosDeOrganismo, id: string): FormConfig {
  const { tipos, localidades, organismos, organismo } = datos;
  let conCatalogos = updateFormConfigOptions(config, 'typeId', tipos.map((t) => ({ id: t.id, name: t.nombre })));

  conCatalogos = updateFormConfigTree(conCatalogos, 'parentId', {
    nodes: nodosDelArbol(organismos, new Map(tipos.map((t) => [t.id, t.nombre])), id),
    self: {
      id: id || null,
      label: organismo?.nombre ?? 'Nuevo organismo',
      tag: 'Este organismo',
    },
  });

  return updateFormConfigOptions(conCatalogos, 'baseLocationId', [
    { id: '', name: 'Sin localidad' },
    ...localidades.map((l) => ({ id: l.id, name: l.nombre })),
  ]);
}

/** Valores con los que abre el formulario en edición. */
export function valorInicialDe(organismo: OrganismoVM): Record<string, unknown> {
  return {
    nombre: organismo.nombre,
    acronym: organismo.acronym,
    typeId: organismo.typeId,
    parentId: organismo.parentId ?? '',
    baseLocationId: organismo.baseLocationId ?? '',
    activo: organismo.activo,
  };
}

/** Del valor del formulario a lo que recibe el facade ("ninguno" viaja como `null`). */
export function aValorDeOrganismo(data: Record<string, unknown>): OrganismoFormValue {
  return {
    typeId: String(data['typeId'] ?? ''),
    parentId: (data['parentId'] as string) || null,
    baseLocationId: (data['baseLocationId'] as string) || null,
    nombre: String(data['nombre'] ?? ''),
    acronym: String(data['acronym'] ?? ''),
    activo: data['activo'] !== false,
  };
}

/**
 * Organismos del desplegable "Organismo superior". Los que no se pueden elegir se muestran con
 * su motivo en vez de ocultarse: el propio organismo queda afuera (el árbol lo dibuja aparte,
 * como "Este organismo"), su descendencia va como "Depende de este" y los inactivos como tales
 * (el backend rechaza un padre inactivo con 409 `4071`).
 */
export function nodosDelArbol(organismos: OrganismoVM[], tiposPorId: Map<string, string>, id: string): TreeOption[] {
  const dependientes = idsNoElegiblesComoPadre(organismos, id);
  return organismos
    .filter((o) => o.id !== id)
    .map((o) => ({
      id: o.id,
      label: o.nombre,
      meta: tiposPorId.get(o.typeId) ?? '',
      parentId: o.parentId,
      keywords: o.acronym,
      disabledReason: dependientes.has(o.id) ? 'Depende de este' : !o.activo ? 'Inactivo' : undefined,
    }));
}

/**
 * Ids que NO pueden ser padre del organismo en edición: él mismo y toda su descendencia.
 * Elegir un descendiente como padre generaría un ciclo, y la regla de borrado
 * («tiene organismos hijos activos») asume que la jerarquía es un árbol.
 *
 * Recorre en oleadas en vez de bajar recursivamente porque los datos ya existentes
 * pueden contener ciclos creados antes de este control: al marcar cada id una sola vez,
 * el bucle termina siempre. En alta (sin id) no hay nada que excluir.
 */
export function idsNoElegiblesComoPadre(organismos: OrganismoVM[], id: string): Set<string> {
  const noElegibles = new Set<string>();
  if (!id) return noElegibles;

  noElegibles.add(id);
  let huboCambios = true;
  while (huboCambios) {
    huboCambios = false;
    for (const o of organismos) {
      if (o.parentId && noElegibles.has(o.parentId) && !noElegibles.has(o.id)) {
        noElegibles.add(o.id);
        huboCambios = true;
      }
    }
  }
  return noElegibles;
}
