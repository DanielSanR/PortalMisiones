import { API_CODES } from '@core/constants/api-codes.constants';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';
import { DestinatariosFacade, DestinatarioVM } from '@features/destinatarios';
import { FormDialogData } from '@shared/components/form-dialog';
import { formDialogEstatico } from '@shared/components/form-dialog/form-dialog-estatico';

/** Rechazos del backend que se marcan en su campo. */
const CONFLICTOS: ConflictoDeCampo[] = [
  {
    // Nombre repetido (400 `4072`).
    code: API_CODES.ENTITY_CONFLICT,
    control: 'nombre',
    mensaje: 'Ya existe un destinatario con ese nombre',
  },
];

/** Configuración del diálogo de alta/edición (`FormDialogComponent`). `destinatario` null = alta. */
export function dialogoDeDestinatario(facade: DestinatariosFacade, destinatario: DestinatarioVM | null): FormDialogData<DestinatarioVM> {
  return formDialogEstatico({
    titulo: destinatario ? 'Editar destinatario' : 'Nuevo destinatario',
    subtitulo: destinatario ? `Modificá los datos de «${destinatario.nombre}».` : 'Indicá a quién puede estar dirigido un trámite.',
    textoGuardar: destinatario ? 'Guardar cambios' : 'Crear destinatario',
    requiereCambios: !!destinatario,
    formId: 'destinatario-dialog-form',
    fields: [
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Ej: persona_humana, empresa, extranjero',
        validations: {
          required: true,
          minLength: 3,
          maxLength: 100,
          mensajes: { required: 'El nombre es obligatorio', minlength: 'Tiene que tener al menos 3 caracteres' },
        },
      },
    ],
    initialData: destinatario ? { nombre: destinatario.nombre } : null,
    guardar: (valor) => {
      const nombre = String(valor['nombre'] ?? '').trim();
      return destinatario ? facade.update(destinatario.id, { nombre }) : facade.create({ nombre });
    },
    conflictos: CONFLICTOS,
    fallback: 'No se pudo guardar el destinatario. Intentá de nuevo.',
  });
}
