import { API_CODES } from '@core/constants/api-codes.constants';
import { extractErrorCode } from '@core/models/api-response.model';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';
import { TiposOrganismoFacade, TipoOrganismoVM } from '@features/tipos-organismo';
import { FormDialogData } from '@shared/components/form-dialog';
import { formDialogEstatico } from '@shared/components/form-dialog/form-dialog-estatico';

/** 409 `4066` al ELIMINAR un tipo desde el listado (el `errorDeAccion` del confirm); `null` para el resto. */
export function errorDeEliminarTipo(err: unknown): string | null {
  return extractErrorCode((err as { error?: unknown } | null)?.error) === API_CODES.ORGANISM_TYPE_IN_USE
    ? 'No se puede eliminar: hay organismos activos de este tipo. Cambiales el tipo o dalos de baja primero.'
    : null;
}

/** Rechazos del backend con texto propio. */
const CONFLICTOS: ConflictoDeCampo[] = [
  {
    // El `code` que el backend deriva del nombre ya existe (409 `4063`).
    code: API_CODES.ORGANISM_TYPE_CODE_TAKEN,
    control: 'nombre',
    mensaje: 'Ya existe un tipo de organismo con ese nombre',
  },
  {
    // Desactivar un tipo con organismos activos (409 `4066`). Sin `control`: el toggle no tiene dónde
    // mostrar un error propio, así que el motivo va al banner, junto a "Guardar".
    code: API_CODES.ORGANISM_TYPE_IN_USE,
    mensaje: 'No se puede desactivar: hay organismos activos de este tipo',
  },
];

/** Configuración del diálogo de alta/edición (`FormDialogComponent`). `tipo` null = alta. */
export function dialogoDeTipoOrganismo(facade: TiposOrganismoFacade, tipo: TipoOrganismoVM | null): FormDialogData<TipoOrganismoVM> {
  return formDialogEstatico({
    titulo: tipo ? 'Editar tipo de organismo' : 'Nuevo tipo de organismo',
    subtitulo: tipo ? `Modificá los datos de «${tipo.nombre}».` : 'Clasifica a los organismos: ministerio, secretaría, ente.',
    textoGuardar: tipo ? 'Guardar cambios' : 'Crear tipo',
    requiereCambios: !!tipo,
    formId: 'tipo-organismo-dialog-form',
    fields: [
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Ej: Ministerio, Secretaría',
        validations: { required: true, maxLength: 100, mensajes: { required: 'El nombre es obligatorio' } },
      },
      {
        name: 'descripcion',
        label: 'Descripción',
        type: 'textarea',
        placeholder: 'Descripción breve del tipo de organismo',
        hint: 'Opcional.',
        validations: { maxLength: 255 },
      },
      {
        name: 'activo',
        label: 'Tipo activo',
        type: 'checkbox',
        hint: 'Un tipo inactivo no se ofrece al cargar organismos.',
        value: true,
      },
    ],
    initialData: tipo ? { nombre: tipo.nombre, descripcion: tipo.descripcion ?? '', activo: tipo.activo } : null,
    guardar: (valor) => {
      const form = {
        nombre: String(valor['nombre'] ?? '').trim(),
        descripcion: String(valor['descripcion'] ?? '').trim(),
        activo: valor['activo'] !== false,
      };
      return tipo ? facade.update(tipo.id, form) : facade.create(form);
    },
    conflictos: CONFLICTOS,
    fallback: 'No se pudo guardar el tipo de organismo. Intentá de nuevo.',
  });
}
