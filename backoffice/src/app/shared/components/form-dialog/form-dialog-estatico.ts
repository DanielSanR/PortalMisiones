import { of } from 'rxjs';
import { FieldConfig } from '@core/models/field.interface';
import { ConflictoDeCampo, aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import type { FormDialogData } from './form-dialog.component';

/**
 * Un formulario en diálogo que no necesita cargar nada: los campos y los valores iniciales ya se
 * conocen al abrirlo (entidades de catálogo, cambio de una credencial).
 */
export interface FormDialogEstatico<R> extends Pick<
  FormDialogData<R>,
  'titulo' | 'subtitulo' | 'textoGuardar' | 'textoGuardando' | 'requiereCambios' | 'mensajeDescartar' | 'formId' | 'guardar'
> {
  fields: FieldConfig[];
  /** Valores con los que abre (edición). Sin esto, cada campo arranca con su `value`. */
  initialData?: Record<string, unknown> | null;
  /** Rechazos del backend con texto propio; con `control`, se marcan en ese campo. */
  conflictos?: ConflictoDeCampo[];
  /** Mensaje si el backend rechaza sin motivo legible. */
  fallback: string;
}

/**
 * Arma el `FormDialogData` de un formulario estático: carga inmediata y errores de guardado
 * traducidos con `aplicarErrorDeGuardado`.
 *
 * Vive fuera del barrel a propósito: las páginas lo importan de forma estática, mientras que el
 * componente del diálogo (con el motor de formularios) se baja en diferido con `abrirFormDialog`.
 */
export function formDialogEstatico<R>(config: FormDialogEstatico<R>): FormDialogData<R> {
  const { fields, initialData, conflictos, fallback, ...marco } = config;
  return {
    ...marco,
    cargar: () => of({ fields, initialData: initialData ?? null }),
    errorDeGuardado: (err, form) => aplicarErrorDeGuardado(err, form, conflictos ?? [], fallback),
  };
}
