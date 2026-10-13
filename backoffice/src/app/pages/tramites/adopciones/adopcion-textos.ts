import { Observable } from 'rxjs';
import { AdopcionVM } from '@features/adopciones';
import { ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * Texto del confirm "Deshabilitar", compartido por el listado y el detalle. Deshabilitar es el
 * `DELETE` lógico (`enabled=false`): deja de listarse y no hay forma de verla desde el listado (P-4).
 */
function mensajeDeshabilitar(adopcion: AdopcionVM): string {
  const titulo = adopcion.plantillaTitulo ?? 'este trámite';
  const organismo = adopcion.organismoNombre ? ` en ${adopcion.organismoNombre}` : '';
  return `${titulo}${organismo} deja de listarse en Trámites del organismo y el trámite deja de verse en el portal. `
    + 'Para volver a ofrecerlo vas a tener que adoptarlo de nuevo.';
}

/** `data` del `ConfirmDialogComponent` de "Deshabilitar" (listado y detalle). */
export function confirmDeshabilitar(adopcion: AdopcionVM, accion: () => Observable<unknown>): ConfirmDialogData {
  return {
    title: '¿Deshabilitar el trámite del organismo?',
    message: mensajeDeshabilitar(adopcion),
    highlight: adopcion.plantillaTitulo ?? undefined,
    danger: true,
    confirmText: 'Sí, deshabilitar',
    busyText: 'Deshabilitando...',
    confirmAction: accion,
  };
}
