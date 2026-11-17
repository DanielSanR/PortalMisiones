import { map } from 'rxjs';
import { FieldConfig } from '@core/models/field.interface';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { canonicalizarSlug } from '@core/utils/slug.utils';
import { EtiquetaFormData, EtiquetaFormValue, EtiquetasFacade, EtiquetaVM } from '@features/etiquetas';
import { FormDialogData } from '@shared/components/form-dialog';
import { CONFLICTOS_ETIQUETA, FALLBACK_ETIQUETA } from './etiqueta-save-error';

/**
 * Campos de `Tag` (BACKEND_API_SPEC.md §5.5): solo `slug` + organismo opcional. `local` no se pide: lo
 * deriva el alcance (con organismo ⇒ local; sin ⇒ global).
 *
 * En edición el organismo queda bloqueado: una etiqueta no cambia de alcance (`TagService.updateTag` lo
 * rechaza con el mismo 400 `4072` del slug repetido, y se leería como "slug repetido"). El valor viaja
 * igual al guardar (el form entrega `getRawValue()`), que es lo que el backend espera.
 */
function camposDeEtiqueta(organismos: EtiquetaFormData['organismos'], etiqueta: EtiquetaVM | null): FieldConfig[] {
  const esEdicion = !!etiqueta;
  const opciones = organismos.map((o) => ({ id: o.id, name: o.nombre }));
  // Sin `READ_ORGANISM` el catálogo llega vacío: el campo bloqueado igual tiene que decir de qué organismo es.
  if (etiqueta?.organismoId && !opciones.some((o) => o.id === etiqueta.organismoId)) {
    opciones.push({ id: etiqueta.organismoId, name: etiqueta.organismoNombre ?? 'Organismo de la etiqueta' });
  }
  return [
    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      mono: true,
      placeholder: 'Ej: salud, adultos-mayores',
      hint: 'Se guarda en minúsculas, sin tildes y con guiones en lugar de espacios.',
      // El backend canonicaliza (`TagService.createTag`): se muestra cómo va a quedar.
      preview: { label: 'Se guardará como:', transform: canonicalizarSlug },
      validations: { required: true, maxLength: 100, mensajes: { required: 'El slug es obligatorio' } },
    },
    {
      name: 'organismoId',
      label: 'Organismo',
      type: 'select',
      // '' = sin organismo ⇒ etiqueta global. Si el catálogo no se pudo leer (sin `READ_ORGANISM`),
      // queda solo esta opción y el form sigue sirviendo para globales.
      placeholder: 'Ninguno — etiqueta global',
      hint: esEdicion
        ? 'No se puede cambiar: el alcance de una etiqueta se elige al crearla.'
        : 'Con organismo es una etiqueta local de ese organismo; sin organismo es global.',
      disabled: esEdicion,
      options: [
        { id: '', name: 'Ninguno — etiqueta global' },
        ...opciones,
      ],
    },
  ];
}

/**
 * Configuración del diálogo de alta/edición de etiqueta (`FormDialogComponent`). `etiqueta` null = alta.
 * Los campos se arman al abrir, con el catálogo de organismos y la etiqueta releída del backend.
 */
export function dialogoDeEtiqueta(facade: EtiquetasFacade, etiqueta: EtiquetaVM | null): FormDialogData<EtiquetaVM> {
  return {
    titulo: etiqueta ? 'Editar etiqueta' : 'Nueva etiqueta',
    subtitulo: etiqueta ? `Modificá los datos de «${etiqueta.slug}».` : 'Una palabra clave para encontrar trámites en el portal.',
    textoGuardar: etiqueta ? 'Guardar cambios' : 'Crear etiqueta',
    requiereCambios: !!etiqueta,
    formId: 'etiqueta-dialog-form',
    cargar: () => facade.getFormData(etiqueta?.id ?? null).pipe(
      map((datos) => ({
        fields: camposDeEtiqueta(datos.organismos, datos.etiqueta ?? etiqueta),
        initialData: datos.etiqueta
          ? { slug: datos.etiqueta.slug, organismoId: datos.etiqueta.organismoId ?? '' }
          : null,
      })),
    ),
    errorDeCarga: () => ({
      titulo: etiqueta ? 'No pudimos cargar la etiqueta' : 'No pudimos cargar el formulario',
      texto: 'Revisá tu conexión e intentá de nuevo. No se modificó nada.',
      reintentable: true,
    }),
    guardar: (valor) => {
      const form: EtiquetaFormValue = {
        slug: String(valor['slug'] ?? ''),
        organismoId: (valor['organismoId'] as string) || null,
      };
      return etiqueta ? facade.update(etiqueta.id, form) : facade.create(form);
    },
    errorDeGuardado: (err, form) => aplicarErrorDeGuardado(err, form, CONFLICTOS_ETIQUETA, FALLBACK_ETIQUETA),
  };
}
