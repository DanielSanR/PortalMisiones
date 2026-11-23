import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, filter, finalize, merge, timer } from 'rxjs';
import { textoDeErrorHttp } from '@core/utils/http-error-text.utils';

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
   * `afterClosed()` emite `true` solo si la acción tuvo éxito: emitió un valor, o completó sin emitir
   * (una acción `void` que termina con `EMPTY` también terminó bien; lo que no anduvo llega por `error`).
   *
   * Sin este campo el diálogo se comporta como siempre (cierra con `true` al confirmar),
   * así que los consumidores existentes no cambian.
   */
  confirmAction?: () => Observable<unknown>;
  /** Texto del botón mientras `confirmAction` corre (ej. "Eliminando…"). */
  busyText?: string;
  /**
   * Texto propio para un fallo de `confirmAction` (p. ej. un código de negocio con un motivo preciso). Si
   * devuelve `null`/vacío se usa el texto compartido según el tipo de error (`textoDeErrorHttp`) y, si no es
   * un error HTTP reconocible, el genérico. El `message` del backend no se muestra nunca.
   */
  errorDeAccion?: (err: unknown) => string | null;
}

/** Tiempo de espera de `confirmAction` antes de avisar que está tardando. */
const DEMORA_MS = 8000;

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly dialogRef = inject<MatDialogRef<ConfirmDialogComponent>>(MatDialogRef);
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  // OnPush: el estado cambia en callbacks async (timer, finalize, error) que no marcan la vista.
  private readonly cdr = inject(ChangeDetectorRef);

  /**
   * La acción async está en vuelo: bloquea el cierre y "Confirmar" (con `aria-disabled`, no `disabled`: el
   * botón conserva el foco, y `confirmar()` descarta la repetición). Se lo ve no disponible con la clase
   * global `.is-unavailable` (la misma de `appUnavailable`).
   */
  ejecutando = false;
  /**
   * Con la acción en vuelo se intentó cerrar con Escape o tocando afuera, que están bloqueados: se dice por
   * qué no pasó nada y cómo salir (Cancelar). Se apaga cuando la acción termina.
   */
  cierreBloqueado = false;
  /** Por qué falló la última ejecución de `confirmAction`. El diálogo queda abierto para reintentar. */
  errorMensaje = '';
  /** La acción lleva más de {@link DEMORA_MS}: se muestra un aviso (Cancelar nunca se bloquea). */
  lenta = false;
  private ejecucion?: Subscription;

  constructor() {
    // Escape y el clic afuera no cierran mientras corre la acción (`disableClose`): que no sea en silencio.
    merge(
      this.dialogRef.keydownEvents().pipe(filter((evento) => evento.key === 'Escape')),
      this.dialogRef.backdropClick(),
    )
      .pipe(filter(() => this.ejecutando && !this.cierreBloqueado), takeUntilDestroyed())
      .subscribe(() => {
        this.cierreBloqueado = true;
        this.cdr.markForCheck();
      });
  }

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
    this.cierreBloqueado = false;
    this.errorMensaje = '';
    this.dialogRef.disableClose = true;
    let cerrado = false;
    // `ejecutando` no se apaga con el éxito: el diálogo se está cerrando y un segundo clic o Enter
    // durante la animación no tiene que repetir la acción.
    const cerrarConExito = (): void => {
      if (cerrado) return;
      cerrado = true;
      this.dialogRef.close(true);
    };
    const aviso = timer(DEMORA_MS).subscribe(() => {
      this.lenta = true;
      this.cdr.markForCheck();
    });
    this.ejecucion = this.data.confirmAction()
      .pipe(finalize(() => {
        aviso.unsubscribe();
        this.lenta = false;
        this.cierreBloqueado = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: cerrarConExito,
        // Completó sin emitir (p. ej. una acción `void` resuelta con `EMPTY`): terminó bien. Sin esto el
        // botón quedaría en "Procesando…" para siempre, con el cierre bloqueado.
        complete: cerrarConExito,
        // El error se cuenta acá mismo y el diálogo sigue abierto: el usuario puede reintentar o
        // cancelar. (Las mutaciones HTTP van con `sinDialogoGlobal()` para no duplicarlo.)
        error: (err: unknown) => {
          this.ejecutando = false;
          this.dialogRef.disableClose = false;
          this.errorMensaje = this.data.errorDeAccion?.(err)
            || textoDeErrorHttp(err, 'No se pudo completar la acción. Intentá de nuevo.', { contexto: 'accion' });
          // El foco sigue en "Confirmar" (nunca se deshabilitó) y el motivo se anuncia solo: el `<p>` del
          // error es `role="alert"` y se monta recién ahora (se desmonta al reintentar, así vuelve a anunciarse).
          this.cdr.markForCheck();
        },
      });
  }
}
