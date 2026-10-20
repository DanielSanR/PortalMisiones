import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, Subscription, finalize, timer } from 'rxjs';
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
   * solo hasta que termina: el botón queda en spinner. "Cancelar" sigue operable: abandona la
   * espera (cancela la suscripción) y cierra con `false`; si tarda de más se avisa en pantalla.
   * `afterClosed()` emite `true` solo si la acción tuvo éxito.
   *
   * Sin este campo el diálogo se comporta como siempre (cierra con `true` al confirmar),
   * así que los consumidores existentes no cambian.
   */
  confirmAction?: () => Observable<unknown>;
  /** Texto del botón mientras `confirmAction` corre (ej. "Eliminando..."). */
  busyText?: string;
}

/** Tiempo de espera de `confirmAction` antes de avisar que está tardando. */
const DEMORA_MS = 8000;

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './confirm-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  /** La acción async está en vuelo: bloquea los botones y el cierre. */
  ejecutando = false;
  /** Por qué falló la última ejecución de `confirmAction`. El diálogo queda abierto para reintentar. */
  errorMensaje = '';
  /** La acción lleva más de {@link DEMORA_MS}: se muestra un aviso (Cancelar nunca se bloquea). */
  lenta = false;
  private ejecucion?: Subscription;

  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
    // OnPush: el estado cambia en callbacks async (timer, finalize, error) que no marcan la vista.
    private readonly cdr: ChangeDetectorRef,
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

  /** Cancelar: si hay una acción en vuelo se deja de esperarla; en ambos casos cierra con `false`. */
  cancelar(): void {
    this.ejecucion?.unsubscribe();
    this.dialogRef.close(false);
  }

  confirmar(): void {
    if (this.ejecutando) return;

    if (!this.data.confirmAction) {
      this.dialogRef.close(true);
      return;
    }

    this.ejecutando = true;
    this.lenta = false;
    this.errorMensaje = '';
    this.dialogRef.disableClose = true;
    const aviso = timer(DEMORA_MS).subscribe(() => {
      this.lenta = true;
      this.cdr.markForCheck();
    });
    this.ejecucion = this.data.confirmAction()
      .pipe(finalize(() => {
        aviso.unsubscribe();
        this.ejecutando = false;
        this.lenta = false;
        this.dialogRef.disableClose = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => this.dialogRef.close(true),
        // El error se cuenta acá mismo y el diálogo sigue abierto: el usuario puede reintentar o
        // cancelar. (Las mutaciones HTTP van con `sinDialogoGlobal()` para no duplicarlo.)
        error: (err: unknown) => {
          this.errorMensaje = extractErrorMessage((err as { error?: unknown })?.error)
            || 'No se pudo completar la acción. Intentá de nuevo.';
          this.cdr.markForCheck();
        },
      });
  }
}
