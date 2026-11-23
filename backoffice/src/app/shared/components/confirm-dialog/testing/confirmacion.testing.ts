import { MatDialog } from '@angular/material/dialog';

/**
 * Page object mínimo del `ConfirmDialogComponent` abierto en el overlay, para los specs que recorren una
 * confirmación de punta a punta (abrir, confirmar, cancelar, error) con el `MatDialog` real.
 */

/**
 * Dibuja los diálogos abiertos. Hace falta cuando el diálogo se abrió desde un evento del DOM (clic en un
 * botón de la pantalla): `fixture.detectChanges()` solo recorre la vista del fixture, no la del overlay.
 */
export function dibujarDialogos(dialog: MatDialog): void {
  for (const ref of dialog.openDialogs) ref.componentRef?.changeDetectorRef.detectChanges();
}

/** El diálogo de confirmación abierto, o `null`. */
export function confirmacionAbierta(): HTMLElement | null {
  return document.querySelector<HTMLElement>('app-confirm-dialog');
}

/** Título de la confirmación abierta (`''` si no hay). */
export function tituloDeConfirmacion(): string {
  return confirmacionAbierta()?.querySelector('.form-dialog__titulo')?.textContent?.trim() ?? '';
}

/** Motivo del fallo mostrado dentro del diálogo (`''` si no hay). */
export function errorDeConfirmacion(): string {
  return confirmacionAbierta()?.querySelector('.form-dialog__error')?.textContent?.trim() ?? '';
}

/** Pulsa el botón del diálogo cuyo texto contiene `texto` ("Sí, eliminar", "Cancelar"). */
export function pulsarEnConfirmacion(texto: string): void {
  const boton = Array.from(confirmacionAbierta()?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    .find((b) => b.textContent?.includes(texto));
  if (!boton) throw new Error(`La confirmación no tiene un botón "${texto}"`);
  boton.click();
}
