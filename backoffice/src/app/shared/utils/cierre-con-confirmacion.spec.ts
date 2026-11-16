import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subject, of } from 'rxjs';
import { cierreConConfirmacion } from './cierre-con-confirmacion';

describe('cierreConConfirmacion — foco tras "Seguir editando"', () => {
  let contenedor: HTMLElement;
  let primero: HTMLInputElement;
  let segundo: HTMLInputElement;
  let backdropClick: Subject<MouseEvent>;
  let close: jasmine.Spy;

  /** `descartar`: lo que responde la pregunta ("Seguir editando" = `false`). */
  function armar(descartar: boolean): void {
    backdropClick = new Subject<MouseEvent>();
    close = jasmine.createSpy('close');
    const dialogRef = {
      id: 'dlg-test', close, disableClose: false,
      backdropClick: () => backdropClick,
      keydownEvents: () => new Subject<KeyboardEvent>(),
    } as unknown as MatDialogRef<unknown, unknown>;
    const dialog = { open: () => ({ afterClosed: () => of(descartar) }) } as unknown as MatDialog;

    cierreConConfirmacion({
      dialog,
      dialogRef,
      destroyRef: TestBed.inject(DestroyRef),
      hayCambios: () => true,
      ocupado: () => false,
    });
  }

  beforeEach(() => {
    contenedor = document.createElement('div');
    contenedor.id = 'dlg-test';
    primero = document.createElement('input');
    segundo = document.createElement('input');
    contenedor.append(primero, segundo);
    document.body.append(contenedor);
  });

  afterEach(() => contenedor.remove());

  const clicAfuera = (detail = 1): Promise<void> => {
    // El clic en el fondo saca el foco del campo antes de que llegue el evento de Material.
    (document.activeElement as HTMLElement | null)?.blur();
    backdropClick.next({ detail } as MouseEvent);
    return new Promise((resolve) => setTimeout(resolve));
  };

  it('devuelve el foco al campo que lo tenía antes del clic afuera', async () => {
    armar(false);
    segundo.focus();

    await clicAfuera();

    expect(document.activeElement).toBe(segundo);
    expect(close).not.toHaveBeenCalled();
  });

  it('si nada del diálogo tuvo el foco, lo manda al primer campo', async () => {
    armar(false);

    await clicAfuera();

    expect(document.activeElement).toBe(primero);
  });

  it('descartando cierra el diálogo y no mueve el foco', async () => {
    armar(true);
    segundo.focus();

    await clicAfuera();

    expect(close).toHaveBeenCalled();
    expect(document.activeElement).not.toBe(segundo);
  });

  it('ignora el segundo clic de un doble clic (detail > 1)', async () => {
    armar(false);
    segundo.focus();

    await clicAfuera(2);

    expect(document.activeElement).toBe(document.body);
    expect(close).not.toHaveBeenCalled();
  });
});
