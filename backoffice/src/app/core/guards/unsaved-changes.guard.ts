import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * La implementa cualquier pantalla que pueda perder trabajo al navegar fuera.
 * Devolver `false` cuando no haya nada que perder: el guard no pregunta.
 */
export interface PuedeTenerCambiosSinGuardar {
  tieneCambiosSinGuardar(): boolean;
}

/**
 * Pide confirmación antes de abandonar un formulario con cambios sin guardar.
 * Cubre tanto el botón "Cancelar" como la navegación del sidenav o el breadcrumb,
 * que hasta ahora descartaban el formulario sucio sin avisar.
 *
 * Se aplica por ruta:
 *   { path: '...', component: XForm, canDeactivate: [unsavedChangesGuard] }
 *
 * Nota: no intercepta el cierre o recarga de la pestaña del navegador — eso
 * requiere `beforeunload` y es una decisión aparte.
 */
export const unsavedChangesGuard: CanDeactivateFn<PuedeTenerCambiosSinGuardar> = (component) => {
  if (!component?.tieneCambiosSinGuardar?.()) return true;

  return inject(MatDialog).open(ConfirmDialogComponent, {
    data: {
      title: 'Salir sin guardar',
      message: 'Hay cambios sin guardar en este formulario. Si salís ahora se pierden.',
      confirmText: 'Salir sin guardar',
      cancelText: 'Seguir editando',
    },
    panelClass: 'custom-modal-panel',
  })
    .afterClosed()
    .pipe(map((confirmado) => !!confirmado));
};
