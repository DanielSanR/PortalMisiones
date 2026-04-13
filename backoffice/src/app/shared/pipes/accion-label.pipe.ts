import { Pipe, PipeTransform } from '@angular/core';
import { AuditoriaAccion } from '../../core/models/dashboard.model';

const ACCION_LABELS: Record<AuditoriaAccion, string> = {
  crear: 'Creación',
  editar: 'Edición',
  publicar: 'Publicación',
  despublicar: 'Despublicación',
  enviar_revision: 'Envío a revisión',
  eliminar: 'Eliminación',
};

const ACCION_ICONS: Record<AuditoriaAccion, string> = {
  crear: 'add_circle',
  editar: 'edit',
  publicar: 'publish',
  despublicar: 'unpublished',
  enviar_revision: 'rate_review',
  eliminar: 'delete',
};

const ACCION_COLORS: Record<AuditoriaAccion, string> = {
  crear: '#4CAF50',
  editar: '#2196F3',
  publicar: '#1B5E20',
  despublicar: '#F44336',
  enviar_revision: '#FF9800',
  eliminar: '#B71C1C',
};

@Pipe({ name: 'accionLabel', standalone: true })
export class AccionLabelPipe implements PipeTransform {
  transform(accion: AuditoriaAccion, format: 'label' | 'icon' | 'color' = 'label'): string {
    if (format === 'icon') return ACCION_ICONS[accion] || 'info';
    if (format === 'color') return ACCION_COLORS[accion] || '#607D8B';
    return ACCION_LABELS[accion] || accion;
  }
}
