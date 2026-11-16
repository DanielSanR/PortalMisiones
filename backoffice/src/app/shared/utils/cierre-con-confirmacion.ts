import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { filter, firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from '../components/confirm-dialog/confirm-dialog.component';

export const MENSAJE_DESCARTAR = 'Hay cambios sin guardar. Si cerrás ahora se pierden.';
/** Pregunta "¿descartar los cambios?". `true` = el usuario eligió descartar. */
export async function confirmarDescarte(dialog: MatDialog, mensaje: string = MENSAJE_DESCARTAR): Promise<boolean> {
  const descartar = await firstValueFrom(
    dialog.open<ConfirmDialogComponent, unknown, boolean>(ConfirmDialogComponent, {
      data: {
        title: 'Descartar los cambios',
        message: mensaje,
        confirmText: 'Descartar cambios',
        cancelText: 'Seguir editando',
      },
      panelClass: 'custom-modal-panel',
    }).afterClosed(),
  );
  return !!descartar;
}

export interface CierreConConfirmacionConfig {
  dialog: MatDialog;
  dialogRef: MatDialogRef<unknown, unknown>;
  destroyRef: DestroyRef;
  /** El usuario cambió algo que todavía no se guardó. */
  hayCambios: () => boolean;
  /** Hay un guardado en vuelo: no se cierra hasta que termine. */
  ocupado: () => boolean;
  /** Texto de la pregunta; por defecto {@link MENSAJE_DESCARTAR}. */
  mensaje?: string;
}

/**
 * Criterio de cierre único de todo diálogo de formulario: la X, Cancelar, Escape y el clic afuera pasan
 * por el mismo camino. Sin cambios cierra directo; con cambios sin guardar pregunta antes de descartarlos;
 * guardando no cierra. Deja `disableClose` en `true` (Material no cierra por su cuenta) y escucha Escape y
 * el clic afuera. Devuelve la función que usan los botones de cierre.
 *
 * Llamarlo una sola vez por diálogo (en el constructor o en un inicializador de campo).
 */
export function cierreConConfirmacion(config: CierreConConfirmacionConfig): () => Promise<void> {
  const { dialog, dialogRef, destroyRef } = config;
  /** Hay una pregunta abierta: no se apila otra. */
  let confirmando = false;

  /**
   * Último control del diálogo que tuvo el foco. El clic afuera lo manda a `body` antes de que lleguemos
   * a preguntar, así que Material no tiene a dónde devolverlo al cerrar "Seguir editando".
   */
  let ultimoEnfocado: HTMLElement | null = null;
  const contenedor = (): HTMLElement | null => document.getElementById(dialogRef.id);
  // Se escucha en `document` y se filtra por el contenedor en cada evento: al crearse el diálogo (acá) el
  // contenedor todavía no tiene su `id` en el DOM, así que no se puede enganchar el listener en él.
  const alEnfocar = (evento: FocusEvent): void => {
    const destino = evento.target;
    if (destino instanceof HTMLElement && contenedor()?.contains(destino)) ultimoEnfocado = destino;
  };
  document.addEventListener('focusin', alEnfocar);
  destroyRef.onDestroy(() => document.removeEventListener('focusin', alEnfocar));

  const devolverFoco = (): void => {
    const raiz = contenedor();
    if (!raiz) return;
    const activo = document.activeElement;
    if (activo && activo !== document.body && raiz.contains(activo)) return;
    const destino = ultimoEnfocado && raiz.contains(ultimoEnfocado) && ultimoEnfocado.isConnected
      ? ultimoEnfocado
      : raiz.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]');
    destino?.focus();
  };

  const intentarCerrar = async (): Promise<void> => {
    if (config.ocupado() || confirmando) return;
    if (config.hayCambios()) {
      confirmando = true;
      let descartar = false;
      try {
        descartar = await confirmarDescarte(dialog, config.mensaje);
      } finally {
        confirmando = false;
      }
      if (!descartar) {
        devolverFoco();
        return;
      }
    }
    dialogRef.close();
  };

  dialogRef.disableClose = true;
  // El segundo clic de un doble clic sobre el botón que abrió el diálogo cae en el fondo recién creado
  // (`detail` = 2): no es una intención de cerrar. Sin esto, el diálogo se abría y se cerraba solo.
  dialogRef.backdropClick()
    .pipe(filter((evento) => !(evento?.detail > 1)), takeUntilDestroyed(destroyRef))
    .subscribe(() => void intentarCerrar());
  dialogRef.keydownEvents()
    .pipe(filter((evento) => evento.key === 'Escape'), takeUntilDestroyed(destroyRef))
    .subscribe((evento) => {
      evento.preventDefault();
      void intentarCerrar();
    });

  return intentarCerrar;
}
