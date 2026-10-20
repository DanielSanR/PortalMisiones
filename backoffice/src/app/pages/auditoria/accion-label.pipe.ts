import { Pipe, PipeTransform } from '@angular/core';
import { AuditoriaAccion } from '@features/auditoria';

const ACCION_LABELS: Record<AuditoriaAccion, string> = {
  crear: 'Creación',
  editar: 'Edición',
  publicar: 'Publicación',
  despublicar: 'Despublicación',
  enviar_revision: 'Envío a revisión',
  eliminar: 'Eliminación',
};

// Nombres de íconos Phosphor (sin prefijo "ph-"; ver mapeo en el pipe).
const ACCION_ICONS: Record<AuditoriaAccion, string> = {
  crear: 'plus-circle',
  editar: 'pencil-simple',
  publicar: 'cloud-arrow-up',
  despublicar: 'eye-slash',
  enviar_revision: 'paper-plane-tilt',
  eliminar: 'trash',
};

/**
 * Tono de la pill global (`.pill--<tono>`, shared-styles): las acciones de publicación usan los tonos de
 * estado (`--theme-estado-*`) para que el color diga lo mismo que en las fichas; el resto, tonos semánticos.
 * El color nunca es lo único que distingue la acción: siempre van el ícono y el texto.
 */
const ACCION_TONOS: Record<AuditoriaAccion, string> = {
  crear: 'success',
  editar: 'neutral',
  publicar: 'publicado',
  despublicar: 'despublicado',
  enviar_revision: 'revision',
  eliminar: 'danger',
};

/**
 * Etiqueta / ícono / tono de una acción de auditoría. Vive en `pages/auditoria` (no en `shared`)
 * porque depende del modelo del feature: `shared` no debe importar de `@features/*`.
 */
@Pipe({ name: 'accionLabel', standalone: true })
export class AccionLabelPipe implements PipeTransform {
  transform(accion: AuditoriaAccion, format: 'label' | 'icon' | 'tone' = 'label'): string {
    if (format === 'icon') return ACCION_ICONS[accion] || 'info';
    if (format === 'tone') return ACCION_TONOS[accion] || 'neutral';
    return ACCION_LABELS[accion] || accion;
  }
}
