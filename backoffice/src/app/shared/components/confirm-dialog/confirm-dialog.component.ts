import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, finalize } from 'rxjs';
import { extractErrorMessage } from '../../../core/models/api-response.model';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /**
   * Acción destructiva: ícono de advertencia sobre la escala de ERROR y botón rojo
   * (Kitchen Sink §07). Si no se declara, se infiere del texto de confirmación para no
   * romper a los consumidores que ya existen.
   */
  danger?: boolean;
  /**
   * Fragmento del mensaje que nombra al objeto afectado. Se resalta, como en el diseño:
   * "Se eliminará **Ministerio de Salud Pública** y sus 112 trámites…".
   * El mensaje debe contener este texto tal cual para que se destaque.
   */
  highlight?: string;
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
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
})
export class ConfirmDialogComponent {
  /** La acción async está en vuelo: bloquea los botones y el cierre. */
  ejecutando = false;
  /** Por qué falló la última ejecución de `confirmAction`. El diálogo queda abierto para reintentar. */
  errorMensaje = '';

  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  get esDestructivo(): boolean {
    return this.data.danger ?? /elimin|borrar|desactiv/i.test(this.data.confirmText ?? '');
  }

  /**
   * Parte el mensaje alrededor de `highlight` para poder resaltar el nombre del objeto
   * sin inyectar HTML. Si no hay coincidencia, devuelve el mensaje entero como una pieza.
   */
  get partes(): { texto: string; destacado: boolean }[] {
    const { message, highlight } = this.data;
    if (!highlight) return [{ texto: message, destacado: false }];
    const at = message.indexOf(highlight);
    if (at === -1) return [{ texto: message, destacado: false }];
    return [
      { texto: message.slice(0, at), destacado: false },
      { texto: highlight, destacado: true },
      { texto: message.slice(at + highlight.length), destacado: false },
    ].filter((p) => p.texto.length > 0);
  }

  confirmar(): void {
    if (this.ejecutando) return;

    if (!this.data.confirmAction) {
      this.dialogRef.close(true);
      return;
    }

    this.ejecutando = true;
    this.errorMensaje = '';
    this.dialogRef.disableClose = true;
    this.data.confirmAction()
      .pipe(finalize(() => {
        this.ejecutando = false;
        this.dialogRef.disableClose = false;
      }))
      .subscribe({
        next: () => this.dialogRef.close(true),
        // El error se cuenta acá mismo y el diálogo sigue abierto: el usuario puede reintentar o
        // cancelar. (Las mutaciones HTTP van con `sinDialogoGlobal()` para no duplicarlo.)
        error: (err: unknown) => {
          this.errorMensaje = extractErrorMessage((err as { error?: unknown })?.error)
            || 'No se pudo completar la acción. Intentá de nuevo.';
        },
      });
  }
}
