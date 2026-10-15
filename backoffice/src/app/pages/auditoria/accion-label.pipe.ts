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

const ACCION_COLORS: Record<AuditoriaAccion, string> = {
  crear: '#4CAF50',
  editar: '#2196F3',
  publicar: '#1B5E20',
  despublicar: '#F44336',
  enviar_revision: '#FF9800',
  eliminar: '#B71C1C',
};

/**
 * Etiqueta / ícono / color de una acción de auditoría. Vive en `pages/auditoria` (no en `shared`)
 * porque depende del modelo del feature: `shared` no debe importar de `@features/*`.
 */
@Pipe({ name: 'accionLabel', standalone: true })
export class AccionLabelPipe implements PipeTransform {
  transform(accion: AuditoriaAccion, format: 'label' | 'icon' | 'color' = 'label'): string {
    if (format === 'icon') return ACCION_ICONS[accion] || 'info';
    if (format === 'color') return ACCION_COLORS[accion] || '#607D8B';
    return ACCION_LABELS[accion] || accion;
  }
}
