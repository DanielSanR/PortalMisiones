import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, finalize } from 'rxjs';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /**
   * Acción asíncrona opcional. Si se provee, el diálogo la ejecuta al confirmar y NO cierra
   * hasta que termina: el botón queda en spinner y no se puede cancelar mientras corre.
   * `afterClosed()` emite `true` solo si la acción tuvo éxito.
   *
   * Sin este campo el diálogo se comporta como siempre (cierra con `true` al confirmar),
   * así que los consumidores existentes no cambian.
   */
  confirmAction?: () => Observable<unknown>;
  /** Texto del botón mientras `confirmAction` corre (ej. "Eliminando..."). */
  busyText?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
})
export class ConfirmDialogComponent {
  /** La acción async está en vuelo: bloquea los botones y el cierre. */
  ejecutando = false;

  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  confirmar(): void {
    if (this.ejecutando) return;

    if (!this.data.confirmAction) {
      this.dialogRef.close(true);
      return;
    }

    this.ejecutando = true;
    this.dialogRef.disableClose = true;
    this.data.confirmAction()
      .pipe(finalize(() => {
        this.ejecutando = false;
        this.dialogRef.disableClose = false;
      }))
      .subscribe({
        next: () => this.dialogRef.close(true),
        // El interceptor global ya muestra el detalle del error: acá solo cerramos sin confirmar.
        error: () => this.dialogRef.close(false),
      });
  }
}
