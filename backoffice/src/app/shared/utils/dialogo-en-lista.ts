import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { PARAM_DIALOGO, PARAMS_DEL_DIALOGO } from '@core/guards';

/** Lo que cada lista le dice al controlador sobre SU diálogo. `F` = fila de la lista, `R` = lo que devuelve el diálogo al guardar. */
export interface DialogoEnListaConfig<F, R> {
  /** Abre el diálogo. `fila` null = alta; `parentId` solo lo usan las entidades jerárquicas. */
  abrir: (fila: F | null, parentId: string | null) => MatDialogRef<unknown, R> | Promise<MatDialogRef<unknown, R>>;
  /** Fila a editar cuando el pedido llega por URL (`?dialogo=editar&id=…`). */
  buscar: (id: string) => Promise<F | undefined>;
  /** El diálogo cerró con algo guardado (el snackbar, dejar la fila a la vista, etc.). */
  alGuardar: (guardada: R, fila: F | null) => void;
  /** Aviso cuando el `id` de la URL no está en la lista. */
  noEncontrada: string;
}

/**
 * Alta y edición en diálogo sobre una lista (ver DESIGN.md, "Alta y edición: ¿diálogo o página?").
 * Junta lo que toda lista con diálogo repite: un diálogo a la vez, atender el pedido que llega por
 * URL (`?dialogo=nuevo|editar`, adonde redirige `redirigirAlDialogo`), limpiar esos params al cerrar
 * para que recargar no lo reabra, y cerrar el diálogo si la pantalla se destruye.
 *
 * Se crea en un inicializador de campo del componente de la lista (usa `inject`):
 *
 *   private readonly dialogo = new DialogoEnLista<ModalidadVM, ModalidadVM>({ … });
 *   onCreate() { void this.dialogo.abrir(null); }
 *   // al terminar la carga: this.dialogo.listaLista(true)
 */
export class DialogoEnLista<F, R> {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  private actual: MatDialogRef<unknown, R> | null = null;
  /** Hay un diálogo abierto o abriéndose (`config.abrir` puede ser async): no se abre otro. */
  private ocupado = false;
  private destruido = false;
  /** La lista ya cargó: recién ahí se puede buscar la fila de un pedido de edición. */
  private lista = false;

  constructor(private readonly config: DialogoEnListaConfig<F, R>) {
    const destroyRef = inject(DestroyRef);
    // Estando ya en la lista, la paleta de comandos puede pedir el diálogo cambiando solo los params.
    this.route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.atenderUrl());
    // Un diálogo abierto no sobrevive a la pantalla: sin esto quedaría flotando sobre la siguiente.
    destroyRef.onDestroy(() => {
      this.destruido = true;
      this.actual?.close();
    });
  }

  /** La lista avisa cada vez que termina de cargar (`false` si falló o está recargando). */
  listaLista(lista: boolean): void {
    this.lista = lista;
    if (lista) this.atenderUrl();
  }

  /** Abre el diálogo (alta con `fila` null). No hace nada si ya hay uno abierto o abriéndose. */
  async abrir(fila: F | null, parentId: string | null = null): Promise<void> {
    if (this.ocupado || this.destruido) return;
    this.ocupado = true;
    try {
      const ref = await this.config.abrir(fila, parentId);
      if (this.destruido) {
        ref.close();
        return;
      }
      this.actual = ref;
      const guardada = await firstValueFrom(ref.afterClosed());
      if (guardada !== undefined && !this.destruido) this.config.alGuardar(guardada, fila);
    } catch {
      if (!this.destruido) this.avisar('No pudimos abrir el formulario. Intentá de nuevo.');
    } finally {
      this.actual = null;
      this.ocupado = false;
    }
  }

  private atenderUrl(): void {
    const params = this.route.snapshot.queryParamMap;
    const modo = params.get(PARAM_DIALOGO);
    if ((modo !== 'nuevo' && modo !== 'editar') || !this.lista || this.ocupado) return;

    // Pase lo que pase (guardó, canceló, no existe, falló), el pedido se saca de la URL: si quedara,
    // recargar lo repetiría y volver a pedirlo sería navegar a la misma URL, que Angular ignora.
    const pedido = modo === 'nuevo'
      ? this.abrir(null, params.get('parentId'))
      : this.editarPorId(params.get('id') ?? '');
    void pedido.finally(() => this.limpiarUrl());
  }

  private async editarPorId(id: string): Promise<void> {
    let fila: F | undefined;
    try {
      fila = await this.config.buscar(id);
    } catch {
      fila = undefined;
    }
    if (this.destruido) return;
    if (!fila) {
      this.avisar(this.config.noEncontrada);
      return;
    }
    await this.abrir(fila);
  }

  private avisar(mensaje: string): void {
    this.snackBar.open(mensaje, 'OK', { duration: 5000 });
  }

  private limpiarUrl(): void {
    // Si mientras tanto se navegó a otra pantalla (Atrás, logout), no se la pisa volviendo acá.
    if (this.destruido) return;
    const queryParams: Record<string, null> = {};
    for (const clave of PARAMS_DEL_DIALOGO) queryParams[clave] = null;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
