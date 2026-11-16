import { API_CODES } from '@core/constants/api-codes.constants';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';
import { PermisosFacade, PermisoVM } from '@features/permisos';
import { FormDialogData } from '@shared/components/form-dialog';
import { formDialogEstatico } from '@shared/components/form-dialog/form-dialog-estatico';

/** Rechazos del backend que se marcan en su campo. */
const CONFLICTOS: ConflictoDeCampo[] = [
  {
    // Unicidad del código (409 `4062`, alta y edición).
    code: API_CODES.PERMISSION_ALREADY_EXISTS,
    control: 'codigo',
    mensaje: 'Ya existe un permiso con ese código',
  },
];

/**
 * Configuración del diálogo de alta/edición (`FormDialogComponent`). `permiso` null = alta.
 * Backend (§4): Permission = `code` + `description`, los dos `@NotBlank`.
 */
export function dialogoDePermiso(facade: PermisosFacade, permiso: PermisoVM | null): FormDialogData<PermisoVM> {
  return formDialogEstatico({
    titulo: permiso ? 'Editar permiso' : 'Nuevo permiso',
    subtitulo: permiso ? `Modificá los datos de «${permiso.codigo}».` : 'Una acción del sistema que después se asigna a los roles.',
    textoGuardar: permiso ? 'Guardar cambios' : 'Crear permiso',
    requiereCambios: !!permiso,
    formId: 'permiso-dialog-form',
    fields: [
      {
        name: 'codigo',
        label: 'Código',
        type: 'text',
        mono: true,
        placeholder: 'Ej: CREATE_PROCEDURE',
        hint: 'Formato ACCION_RECURSO, en mayúsculas',
        validations: { required: true, maxLength: 100, mensajes: { required: 'El código es obligatorio' } },
      },
      {
        name: 'descripcion',
        label: 'Descripción',
        type: 'textarea',
        placeholder: 'Ej: Permite crear trámites',
        validations: { required: true, maxLength: 255, mensajes: { required: 'La descripción es obligatoria' } },
      },
    ],
    initialData: permiso ? { codigo: permiso.codigo, descripcion: permiso.descripcion ?? '' } : null,
    guardar: (valor) => {
      const form = {
        codigo: String(valor['codigo'] ?? '').trim(),
        descripcion: String(valor['descripcion'] ?? '').trim(),
      };
      return permiso ? facade.update(permiso.id, form) : facade.create(form);
    },
    conflictos: CONFLICTOS,
    fallback: 'No se pudo guardar el permiso. Intentá de nuevo.',
  });
}
