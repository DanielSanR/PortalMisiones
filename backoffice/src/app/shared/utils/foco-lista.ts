import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';

/** Fila de `app-shared-table` (mat-table). El árbol de categorías pasa su propio selector. */
const FILA_TABLA = 'tr.mat-mdc-row';
const CONTROL_FOCUSABLE = 'button:not([disabled]), a[href]';
const BUSCADOR = '.list-search__input';

/**
 * Foco tras eliminar una fila (WCAG 2.4.3 / 3.2.2).
 *
 * El confirm-dialog devuelve el foco al elemento que lo abrió, pero ese botón vivía en la fila
 * borrada: el foco cae en `<body>` y el usuario de teclado pierde su lugar en la lista. Este par de
 * funciones lo deja en la fila que ocupa ahora esa posición (la siguiente; la anterior si era la
 * última) o, si la lista quedó vacía, en el buscador.
 *
 * Uso en la lista:
 *   onDelete(x) { const indice = indiceDeFilaActiva(this.host); … afterClosed … subscribe(() =>
 *     enfocarTrasEliminar(this.host, indice, this.destroyRef)) }
 */

/**
 * Índice (dentro de las filas de `host`) de la fila desde la que se disparó la acción, o -1 si no
 * se puede saber. Se llama ANTES de abrir el diálogo. La acción puede venir de un botón de la fila
 * (foco en la fila) o de un item de `mat-menu` (el foco está en el overlay, pero el disparador
 * "⋮" de la fila sigue con `aria-expanded="true"`).
 */
export function indiceDeFilaActiva(host: HTMLElement, selectorFila: string = FILA_TABLA): number {
  const activo = document.activeElement as HTMLElement | null;
  const origen = (activo && host.contains(activo) ? activo : null)
    ?? host.querySelector<HTMLElement>(`${selectorFila} [aria-expanded="true"]`);
  const fila = origen?.closest(selectorFila);
  return fila ? Array.from(host.querySelectorAll(selectorFila)).indexOf(fila) : -1;
}

/**
 * Mueve el foco a la fila que quedó en `indice` (acotada a la última). Espera un tick para que
 * Angular ya haya quitado la fila borrada del DOM y el diálogo haya soltado el foco.
 */
export function enfocarTrasEliminar(
  host: HTMLElement,
  indice: number,
  destroyRef: DestroyRef,
  selectorFila: string = FILA_TABLA,
): void {
  timer(0).pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
    const filas = host.querySelectorAll(selectorFila);
    if (indice >= 0 && filas.length > 0) {
      const fila = filas[Math.min(indice, filas.length - 1)];
      const control = fila.querySelector<HTMLElement>(CONTROL_FOCUSABLE);
      if (control) {
        control.focus();
        return;
      }
    }
    host.querySelector<HTMLElement>(BUSCADOR)?.focus();
  });
}
