import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { EMPTY, Observable } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from '../components/confirm-dialog/confirm-dialog.component';

/**
 * Abre un `ConfirmDialogComponent` y devuelve su `afterClosed()` (`true` = confirmó).
 *
 * Si ya hay una confirmación abierta (doble clic) no abre otra y devuelve `EMPTY`: completa sin emitir,
 * así que la cadena `.pipe(filter(Boolean), …).subscribe(…)` del llamador simplemente no corre.
 * Un diálogo que no es una confirmación (p. ej. un formulario) no bloquea: la confirmación puede
 * abrirse encima de él.
 */
export function abrirConfirmacion(
  dialog: MatDialog,
  config: MatDialogConfig<ConfirmDialogData>,
): Observable<boolean | undefined> {
  const yaHayConfirmacion = dialog.openDialogs.some((ref) => ref.componentInstance instanceof ConfirmDialogComponent);
  if (yaHayConfirmacion) return EMPTY;
  return dialog
    .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      panelClass: 'custom-modal-panel',
      ...config,
    })
    .afterClosed();
}
