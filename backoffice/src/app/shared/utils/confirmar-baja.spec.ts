import { Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Observable, Subject, throwError } from 'rxjs';
import { ConfirmarBajaConfig, confirmarBaja } from './confirmar-baja';

/** Pantalla mínima con una "lista" de dos filas y un buscador, como las de `app-shared-table`. */
@Component({
  standalone: true,
  template: `
    <input class="list-search__input" aria-label="Buscar" />
    <table>
      @for (fila of filas; track fila) {
        <tr class="mat-mdc-row"><td><button type="button" [attr.data-fila]="fila">Eliminar {{ fila }}</button></td></tr>
      }
    </table>`,
})
class PantallaComponent {
  readonly dialog = inject(MatDialog);
  readonly snackBar = inject(MatSnackBar);
  readonly destroyRef = inject(DestroyRef);
  readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  filas = ['a', 'b'];
}

describe('confirmarBaja', () => {
  let fixture: ComponentFixture<PantallaComponent>;
  let pantalla: PantallaComponent;
  let avisos: jasmine.Spy;
  let ocupado: boolean[];
  let alConfirmar: jasmine.Spy;
  let alCancelar: jasmine.Spy;

  const dialogo = (): HTMLElement | null => document.querySelector('app-confirm-dialog');
  const botonDelDialogo = (texto: string): HTMLButtonElement =>
    Array.from(dialogo()!.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent!.includes(texto))!;
  const botonDeFila = (fila: string): HTMLButtonElement => fixture.nativeElement.querySelector(`[data-fila="${fila}"]`);

  function abrir(accion: () => Observable<unknown>, extra: Partial<ConfirmarBajaConfig> = {}): void {
    confirmarBaja({
      dialog: pantalla.dialog,
      snackBar: pantalla.snackBar,
      destroyRef: pantalla.destroyRef,
      confirmacion: {
        title: '¿Eliminar la fila?', message: 'Se eliminará a.', highlight: 'a', danger: true,
        confirmText: 'Sí, eliminar', busyText: 'Eliminando…', confirmAction: accion,
      },
      aviso: 'Fila eliminada',
      ocupado: (valor) => ocupado.push(valor),
      alConfirmar,
      alCancelar,
      ...extra,
    });
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PantallaComponent, NoopAnimationsModule] });
    fixture = TestBed.createComponent(PantallaComponent);
    pantalla = fixture.componentInstance;
    // En el documento: el foco solo existe en nodos conectados.
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    avisos = spyOn(pantalla.snackBar, 'open');
    ocupado = [];
    alConfirmar = jasmine.createSpy('alConfirmar');
    alCancelar = jasmine.createSpy('alCancelar');
  });

  afterEach(() => {
    pantalla.dialog.closeAll();
    fixture.nativeElement.remove();
  });

  it('abre la confirmación con sus textos y no ejecuta nada hasta confirmar', () => {
    const accion = jasmine.createSpy('accion').and.returnValue(new Subject<void>());
    abrir(accion);

    expect(dialogo()!.textContent).toContain('¿Eliminar la fila?');
    expect(botonDelDialogo('Sí, eliminar')).toBeTruthy();
    expect(accion).not.toHaveBeenCalled();
    expect(ocupado).toEqual([]);
  });

  it('al confirmar ejecuta con la fila ocupada y, cuando termina, la libera, avisa y corre alConfirmar', fakeAsync(() => {
    const respuesta$ = new Subject<void>();
    abrir(() => respuesta$);

    botonDelDialogo('Sí, eliminar').click();
    fixture.detectChanges();
    // El diálogo espera al backend: sigue abierto, sin aviso todavía.
    expect(ocupado).toEqual([true]);
    expect(dialogo()).not.toBeNull();
    expect(avisos).not.toHaveBeenCalled();

    respuesta$.next();
    respuesta$.complete();
    flush();

    expect(ocupado).toEqual([true, false]);
    expect(avisos).toHaveBeenCalledOnceWith('Fila eliminada', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
    expect(alConfirmar).toHaveBeenCalledTimes(1);
    expect(alCancelar).not.toHaveBeenCalled();
  }));

  it('al cancelar no ejecuta ni avisa, y corre alCancelar', fakeAsync(() => {
    const accion = jasmine.createSpy('accion').and.returnValue(new Subject<void>());
    abrir(accion);

    botonDelDialogo('Cancelar').click();
    flush();

    expect(accion).not.toHaveBeenCalled();
    expect(ocupado).toEqual([]);
    expect(avisos).not.toHaveBeenCalled();
    expect(alConfirmar).not.toHaveBeenCalled();
    expect(alCancelar).toHaveBeenCalledTimes(1);
  }));

  it('si la acción falla el diálogo sigue abierto con el motivo, sin aviso, y la fila se libera', fakeAsync(() => {
    abrir(() => throwError(() => new Error('falló')), { confirmacion: {
      title: '¿Eliminar la fila?', message: 'Se eliminará a.', confirmText: 'Sí, eliminar',
      confirmAction: () => throwError(() => new Error('falló')),
      errorDeAccion: () => 'No se puede eliminar: está en uso.',
    } });

    botonDelDialogo('Sí, eliminar').click();
    fixture.detectChanges();
    tick();

    expect(dialogo()).not.toBeNull();
    pantalla.dialog.openDialogs[0].componentInstance.dialogRef._containerInstance._changeDetectorRef.detectChanges();
    expect(ocupado).toEqual([true, false]);
    expect(avisos).not.toHaveBeenCalled();
    expect(alConfirmar).not.toHaveBeenCalled();
    expect(pantalla.dialog.openDialogs[0].componentInstance.errorMensaje).toBe('No se puede eliminar: está en uso.');

    // Cancelar después del error cierra sin confirmar.
    botonDelDialogo('Cancelar').click();
    flush();
    expect(alCancelar).toHaveBeenCalledTimes(1);
    expect(avisos).not.toHaveBeenCalled();
  }));

  it('con una confirmación abierta no abre otra (doble clic)', () => {
    const accion = jasmine.createSpy('accion').and.returnValue(new Subject<void>());
    abrir(accion);
    abrir(accion);

    expect(pantalla.dialog.openDialogs.length).toBe(1);
    expect(alCancelar).not.toHaveBeenCalled();
  });

  it('sin `aviso` no abre ningún snackbar', fakeAsync(() => {
    const respuesta$ = new Subject<void>();
    abrir(() => respuesta$, { aviso: undefined });

    botonDelDialogo('Sí, eliminar').click();
    respuesta$.next();
    respuesta$.complete();
    flush();

    expect(avisos).not.toHaveBeenCalled();
    expect(alConfirmar).toHaveBeenCalledTimes(1);
  }));

  it('sin `ocupado` la acción corre tal cual', fakeAsync(() => {
    const respuesta$ = new Subject<void>();
    const accion = jasmine.createSpy('accion').and.returnValue(respuesta$);
    abrir(accion, { ocupado: undefined });

    botonDelDialogo('Sí, eliminar').click();
    respuesta$.next();
    respuesta$.complete();
    flush();

    expect(accion).toHaveBeenCalledTimes(1);
    expect(ocupado).toEqual([]);
    expect(alConfirmar).toHaveBeenCalledTimes(1);
  }));

  describe('foco tras la baja', () => {
    it('va a la fila que ocupa el lugar de la eliminada', fakeAsync(() => {
      const respuesta$ = new Subject<void>();
      botonDeFila('a').focus();
      abrir(() => respuesta$, { foco: { host: pantalla.host } });

      botonDelDialogo('Sí, eliminar').click();
      pantalla.filas = ['b'];
      fixture.detectChanges();
      respuesta$.next();
      respuesta$.complete();
      flush();
      fixture.detectChanges();

      expect(document.activeElement).toBe(botonDeFila('b'));
    }));

    it('si la lista quedó vacía, va al buscador', fakeAsync(() => {
      const respuesta$ = new Subject<void>();
      botonDeFila('a').focus();
      abrir(() => respuesta$, { foco: { host: pantalla.host } });

      botonDelDialogo('Sí, eliminar').click();
      pantalla.filas = [];
      fixture.detectChanges();
      respuesta$.next();
      respuesta$.complete();
      flush();
      fixture.detectChanges();

      expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.list-search__input'));
    }));
  });
});
