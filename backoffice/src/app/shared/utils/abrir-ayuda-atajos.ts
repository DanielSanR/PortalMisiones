import { MatDialog } from '@angular/material/dialog';
import { AtajoVisible } from '../../core/services/atajos.service';
import { AtajosAyudaDialogComponent, AtajosAyudaDialogData } from '../components/atajos-ayuda-dialog/atajos-ayuda-dialog.component';

/** Abre el diálogo con los atajos vigentes. No abre otro si ya hay uno (doble pulsación). */
export function abrirAyudaAtajos(dialog: MatDialog, atajos: readonly AtajoVisible[]): void {
  if (dialog.openDialogs.some((ref) => ref.componentInstance instanceof AtajosAyudaDialogComponent)) return;
  dialog.open<AtajosAyudaDialogComponent, AtajosAyudaDialogData>(AtajosAyudaDialogComponent, {
    panelClass: 'custom-modal-panel',
    data: { atajos },
  });
}
