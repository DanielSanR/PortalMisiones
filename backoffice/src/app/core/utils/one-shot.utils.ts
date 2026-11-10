import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EmptyError, Observable, firstValueFrom } from 'rxjs';

/** La pantalla que pidió el dato se destruyó con la llamada en vuelo: no hay a quién avisarle. */
export class PantallaDestruidaError extends Error {
  constructor() {
    super('La pantalla se destruyó antes de que terminara la llamada.');
    this.name = 'PantallaDestruidaError';
  }
}

/** ¿El rechazo de {@link unaVez} es solo "la pantalla ya no existe"? Si es así, no hay nada que mostrar. */
export function esPantallaDestruida(err: unknown): boolean {
  return err instanceof PantallaDestruidaError;
}

/**
 * Llamada one-shot de un componente (carga o guardado) como promesa, atada a la vida de la pantalla:
 * `firstValueFrom` + `takeUntilDestroyed`. Si la pantalla se destruye antes, el request se cancela y la
 * promesa rechaza con {@link PantallaDestruidaError}, que el componente ignora.
 *
 * Cualquier otro rechazo es un error de verdad y hay que tratarlo como tal (apagar `saving`/`loading`
 * y avisar). Eso incluye el `EmptyError` de un stream que completa sin emitir con la pantalla VIVA:
 * ignorarlo dejaría el formulario bloqueado para siempre. Por eso no alcanza con mirar el tipo del error.
 */
export function unaVez<T>(source$: Observable<T>, destroyRef: DestroyRef): Promise<T> {
  let destruida = false;
  let dejarDeEscuchar: () => void;
  try {
    dejarDeEscuchar = destroyRef.onDestroy(() => {
      destruida = true;
    });
  } catch {
    // Registrar un `onDestroy` en una vista ya destruida falla: es el mismo caso.
    return Promise.reject(new PantallaDestruidaError());
  }

  return firstValueFrom(source$.pipe(takeUntilDestroyed(destroyRef)))
    .catch((err: unknown) => {
      throw destruida && err instanceof EmptyError ? new PantallaDestruidaError() : err;
    })
    .finally(dejarDeEscuchar);
}
