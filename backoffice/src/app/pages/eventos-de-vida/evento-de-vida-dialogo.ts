import { API_CODES } from '@core/constants/api-codes.constants';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';
import { canonicalizarSlug } from '@core/utils/slug.utils';
import { EventosDeVidaFacade, EventoDeVidaVM } from '@features/eventos-de-vida';
import { FormDialogData } from '@shared/components/form-dialog';
import { formDialogEstatico } from '@shared/components/form-dialog/form-dialog-estatico';

/** Rechazos del backend que se marcan en su campo. */
const CONFLICTOS: ConflictoDeCampo[] = [
  {
    // El slug que sale del nombre ya existe (409 `4072` desde el backend `586b670`; antes 400).
    code: API_CODES.ENTITY_CONFLICT,
    control: 'nombre',
    mensaje: 'Ya existe un evento de vida con ese nombre',
  },
  {
    // Renombrar un evento que ya está asignado a un trámite (409 `4076`).
    code: API_CODES.LIFE_EVENT_ASSIGNED,
    control: 'nombre',
    mensaje: 'No se puede renombrar: está asignado a un trámite',
  },
];

/** Largo mínimo del slug que el backend deriva del nombre (`slug @Size(min = 3)`). */
const MIN_SLUG = 3;

/**
 * El backend valida también lo que deriva del nombre: "ñ?ñ" tiene tres caracteres pero su slug es
 * "n-n" y "¡¡¡" no deja ninguno. Se avisa en el campo en vez de esperar el 400 genérico.
 */
function slugSuficiente(nombre: string): string | null {
  const recortado = nombre.trim();
  if (!recortado) return null; // vacío: lo informa `required`
  return canonicalizarSlug(recortado).length < MIN_SLUG
    ? `Usá al menos ${MIN_SLUG} letras o números: los símbolos y espacios no cuentan`
    : null;
}

/** Configuración del diálogo de alta/edición (`FormDialogComponent`). `evento` null = alta. */
export function dialogoDeEventoDeVida(facade: EventosDeVidaFacade, evento: EventoDeVidaVM | null): FormDialogData<EventoDeVidaVM> {
  return formDialogEstatico({
    titulo: evento ? 'Editar evento de vida' : 'Nuevo evento de vida',
    subtitulo: evento ? `Modificá los datos de «${evento.nombre}».` : 'Un momento de la vida que agrupa trámites en el portal.',
    textoGuardar: evento ? 'Guardar cambios' : 'Crear evento de vida',
    requiereCambios: !!evento,
    formId: 'evento-de-vida-dialog-form',
    fields: [
      {
        name: 'nombre',
        label: 'Nombre',
        type: 'text',
        placeholder: 'Ej: Nacimiento de un hijo, Iniciar un emprendimiento',
        hint: 'El identificador (slug) se genera solo a partir del nombre.',
        // No hay campo `slug`: el backend lo deriva del `name` (`generateSlug`). Se muestra cómo queda.
        preview: { label: 'Identificador (slug):', transform: canonicalizarSlug },
        validations: {
          required: true,
          minLength: 3,
          maxLength: 100,
          validar: slugSuficiente,
          mensajes: { required: 'El nombre es obligatorio', minlength: 'Tiene que tener al menos 3 caracteres' },
        },
      },
    ],
    initialData: evento ? { nombre: evento.nombre } : null,
    guardar: (valor) => {
      const nombre = String(valor['nombre'] ?? '').trim();
      return evento ? facade.update(evento.id, { nombre }) : facade.create({ nombre });
    },
    conflictos: CONFLICTOS,
    fallback: 'No se pudo guardar el evento de vida. Intentá de nuevo.',
  });
}
