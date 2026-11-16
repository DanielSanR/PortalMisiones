import { API_CODES } from '@core/constants/api-codes.constants';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';
import { ModalidadesFacade, ModalidadVM } from '@features/modalidades';
import { FormDialogData } from '@shared/components/form-dialog';
import { formDialogEstatico } from '@shared/components/form-dialog/form-dialog-estatico';

/** Rechazos del backend que se marcan en su campo. */
const CONFLICTOS: ConflictoDeCampo[] = [
  {
    // Nombre repetido, sin distinguir mayúsculas (400 `4072`).
    code: API_CODES.ENTITY_CONFLICT,
    control: 'nombre',
    mensaje: 'Ya existe una modalidad con ese nombre',
  },
];

/** Configuración del diálogo de alta/edición (`FormDialogComponent`). `modalidad` null = alta. */
export function dialogoDeModalidad(facade: ModalidadesFacade, modalidad: ModalidadVM | null): FormDialogData<ModalidadVM> {
  return formDialogEstatico({
    titulo: modalidad ? 'Editar modalidad' : 'Nueva modalidad',
    subtitulo: modalidad ? `Modificá los datos de «${modalidad.nombre}».` : 'Indicá de qué forma se puede realizar un trámite.',
    textoGuardar: modalidad ? 'Guardar cambios' : 'Crear modalidad',
    requiereCambios: !!modalidad,
    formId: 'modalidad-dialog-form',
    fields: [
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Ej: Digital de punta a punta',
        validations: {
          required: true,
          minLength: 3,
          maxLength: 100,
          mensajes: { required: 'El nombre es obligatorio', minlength: 'Tiene que tener al menos 3 caracteres' },
        },
      },
    ],
    initialData: modalidad ? { nombre: modalidad.nombre } : null,
    guardar: (valor) => {
      const nombre = String(valor['nombre'] ?? '').trim();
      return modalidad ? facade.update(modalidad.id, { nombre }) : facade.create({ nombre });
    },
    conflictos: CONFLICTOS,
    fallback: 'No se pudo guardar la modalidad. Intentá de nuevo.',
  });
}
