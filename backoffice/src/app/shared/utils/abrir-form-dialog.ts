import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import type { FormDialogData } from '@shared/components/form-dialog';

/**
 * Abre `FormDialogComponent` con la configuración de siempre. Carga diferida: el diálogo y el motor
 * de formularios recién se bajan la primera vez que se abre uno.
 *
 * `autoFocus: 'dialog'`: abre con el foco en el contenedor y el diálogo lo pasa al primer campo cuando
 * termina de cargar.
 */
export async function abrirFormDialog<R>(dialog: MatDialog, data: FormDialogData<R>): Promise<MatDialogRef<unknown, R>> {
  const { FormDialogComponent } = await import('@shared/components/form-dialog/form-dialog.component');
  return dialog.open<InstanceType<typeof FormDialogComponent>, FormDialogData<R>, R>(FormDialogComponent, {
    data,
    panelClass: 'custom-modal-panel',
    autoFocus: 'dialog',
  });
}
