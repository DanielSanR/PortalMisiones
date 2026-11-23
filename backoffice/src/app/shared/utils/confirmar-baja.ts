import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { ConfirmDialogData } from '../components/confirm-dialog/confirm-dialog.component';
import { abrirConfirmacion } from './abrir-confirmacion';
import { avisarExito } from './avisos';
import { enfocarTrasEliminar, indiceDeFilaActiva } from './foco-lista';

export interface ConfirmarBajaConfig {
  dialog: MatDialog;
  snackBar: MatSnackBar;
  destroyRef: DestroyRef;
  /**
   * Datos de la confirmación: título en pregunta, consecuencia, `highlight`, `danger`, `confirmText`,
   * `busyText`, `confirmAction` (la llamada al facade) y, si hay rechazos de negocio, `errorDeAccion`.
   */
  confirmacion: ConfirmDialogData;
  /** Texto del aviso de éxito ("Etiqueta eliminada"). Sin él no se avisa. */
  aviso?: string;
  /** Marca la fila como ocupada mientras corre `confirmAction` (`true` al empezar, `false` al terminar, bien o mal). */
  ocupado?: (ocupado: boolean) => void;
  /**
   * La fila desaparece de una lista: al terminar, el foco va a la fila que ocupa su lugar (o al buscador
   * si la lista quedó vacía). `host` es el elemento de la pantalla; `selectorFila`, si no es `app-shared-table`.
   */
  foco?: { host: HTMLElement; selectorFila?: string };
  /** Después del aviso: navegar, releer el detalle, etc. */
  alConfirmar?: () => void;
  /** Cerró sin confirmar (Cancelar, Escape, clic afuera), también tras un intento fallido. */
  alCancelar?: () => void;
}

/**
 * Ciclo completo de una acción confirmada (eliminar, desactivar, deshabilitar y, con `danger: false`,
 * cualquier otra que pida confirmación): abre la confirmación (una sola a la vez), ejecuta
 * `confirmAction` con el diálogo abierto y la fila ocupada, muestra el error en el propio diálogo, y al
 * terminar bien devuelve el foco a la lista, avisa y corre `alConfirmar`.
 *
 *   onDelete(etiqueta: EtiquetaVM): void {
 *     confirmarBaja({
 *       dialog: this.dialog, snackBar: this.snackBar, destroyRef: this.destroyRef,
 *       confirmacion: { title: '¿Eliminar la etiqueta?', message: `…`, highlight: etiqueta.slug, danger: true,
 *         confirmText: 'Sí, eliminar', busyText: 'Eliminando…', confirmAction: () => this.facade.delete(etiqueta.id) },
 *       aviso: 'Etiqueta eliminada',
 *       ocupado: this.lista.ocupar(etiqueta.id),
 *       foco: { host: this.host },
 *     });
 *   }
 */
export function confirmarBaja(config: ConfirmarBajaConfig): void {
  const { dialog, snackBar, destroyRef, confirmacion, aviso, ocupado, foco } = config;
  // Foco tras la baja: la fila (y el botón que abrió el diálogo) desaparece; la posición se captura antes de abrirlo.
  const indice = foco ? indiceDeFilaActiva(foco.host, foco.selectorFila) : -1;
  const accion = confirmacion.confirmAction;

  abrirConfirmacion(dialog, {
    data: {
      ...confirmacion,
      // El diálogo queda abierto con el botón en spinner hasta que el backend responde; la fila se bloquea en
      // paralelo para que la lista de atrás no invite a repetir la acción.
      ...(accion && ocupado
        ? {
          confirmAction: () => {
            ocupado(true);
            return accion().pipe(finalize(() => ocupado(false)));
          },
        }
        : {}),
    },
    panelClass: 'custom-modal-panel',
  })
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe((confirmado) => {
      if (!confirmado) {
        config.alCancelar?.();
        return;
      }
      if (foco) enfocarTrasEliminar(foco.host, indice, destroyRef, foco.selectorFila);
      if (aviso) avisarExito(snackBar, aviso);
      config.alConfirmar?.();
    });
}
