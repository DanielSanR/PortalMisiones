import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EMPTY, NEVER, Subject, of, throwError } from 'rxjs';
import { TEXTOS_DE_ERROR_HTTP } from '@core/utils/http-error-text.utils';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

/**
 * El diálogo es OnPush y su estado cambia en callbacks async (timer, finalize, error de la
 * acción): sin `markForCheck` el error o el aviso de demora quedarían sin pintarse.
 */
describe('ConfirmDialogComponent — acción async con OnPush', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  const teclas$ = new Subject<KeyboardEvent>();
  const afuera$ = new Subject<MouseEvent>();
  const dialogRef = {
    close: jasmine.createSpy('close'),
    disableClose: false,
    keydownEvents: () => teclas$,
    backdropClick: () => afuera$,
  };

  function crear(data: ConfirmDialogData): void {
    TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
  }

  const texto = (): string => fixture.nativeElement.textContent as string;

  beforeEach(() => dialogRef.close.calls.reset());

  it('muestra el error de la acción con texto propio (nunca el mensaje del backend) y deja el diálogo abierto', () => {
    crear({
      title: 'Eliminar',
      message: 'Se eliminará el organismo.',
      confirmText: 'Eliminar',
      confirmAction: () => throwError(() => ({ status: 409, error: { code: 4999, message: 'ConstraintViolationException: fk_organism' } })),
    });

    fixture.componentInstance.confirmar();
    fixture.detectChanges();

    expect(texto()).toContain(TEXTOS_DE_ERROR_HTTP.conflicto.accion);
    expect(texto()).not.toContain('ConstraintViolationException');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('un error que no es HTTP reconocible muestra el genérico', () => {
    crear({
      title: 'Eliminar',
      message: 'Se eliminará el organismo.',
      confirmText: 'Eliminar',
      confirmAction: () => throwError(() => ({ error: { message: 'Texto del backend.' } })),
    });

    fixture.componentInstance.confirmar();
    fixture.detectChanges();

    expect(texto()).toContain('No se pudo completar la acción. Intentá de nuevo.');
    expect(texto()).not.toContain('Texto del backend.');
  });

  it('`errorDeAccion` pone un texto propio en lugar del mensaje del backend', () => {
    crear({
      title: 'Desactivar',
      message: 'Se desactivará la cuenta.',
      confirmText: 'Desactivar',
      confirmAction: () => throwError(() => ({ status: 403, error: { code: 4029, message: 'El usuario no tiene permisos para realizar esta acción.' } })),
      errorDeAccion: (err) => ((err as { error: { code: number } }).error.code === 4029 ? 'No podés desactivar esta cuenta.' : null),
    });

    fixture.componentInstance.confirmar();
    fixture.detectChanges();

    expect(texto()).toContain('No podés desactivar esta cuenta.');
    expect(texto()).not.toContain('El usuario no tiene permisos');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('si `errorDeAccion` no reconoce el error, se muestra el texto compartido según el tipo, no el mensaje del backend', () => {
    crear({
      title: 'Desactivar',
      message: 'Se desactivará la cuenta.',
      confirmText: 'Desactivar',
      confirmAction: () => throwError(() => ({ status: 500, error: { code: 5000, message: 'Error interno.' } })),
      errorDeAccion: () => null,
    });

    fixture.componentInstance.confirmar();
    fixture.detectChanges();

    expect(texto()).toContain(TEXTOS_DE_ERROR_HTTP.servidor.accion);
    expect(texto()).not.toContain('Error interno.');
  });

  it('si la acción completa SIN emitir (EMPTY), cuenta como éxito: cierra con `true` y no queda en "Procesando…"', () => {
    crear({ title: 'Desactivar', message: 'Se desactivará.', confirmText: 'Desactivar', confirmAction: () => EMPTY });

    fixture.componentInstance.confirmar();
    fixture.detectChanges();

    expect(dialogRef.close).toHaveBeenCalledOnceWith(true);
  });

  it('si la acción emite y completa, cierra una sola vez', () => {
    crear({ title: 'Desactivar', message: 'Se desactivará.', confirmText: 'Desactivar', confirmAction: () => of(1, 2) });

    fixture.componentInstance.confirmar();

    expect(dialogRef.close).toHaveBeenCalledOnceWith(true);
  });

  it('avisa cuando la acción tarda más de lo habitual', fakeAsync(() => {
    crear({ title: 'Eliminar', message: 'Se eliminará.', confirmText: 'Eliminar', confirmAction: () => NEVER });

    fixture.componentInstance.confirmar();
    fixture.detectChanges();
    tick(8000);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
    fixture.componentInstance.cancelar();
  }));

  /**
   * Foco y anuncio (WCAG 2.4.3 / 4.1.3): "Confirmar" no usa `disabled` nativo mientras corre la acción,
   * porque un botón deshabilitado suelta el foco al `body` y, si la acción falla, nadie lo devuelve.
   */
  describe('foco y anuncio durante la acción', () => {
    let accion$: Subject<unknown>;
    let confirmAction: jasmine.Spy;

    const botonConfirmar = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('button[mat-flat-button]') as HTMLButtonElement;

    /** Diálogo en el documento (el foco solo existe ahí), con la acción en manos de la prueba. */
    function crearEnDocumento(extra: Partial<ConfirmDialogData> = {}): void {
      accion$ = new Subject<unknown>();
      confirmAction = jasmine.createSpy('confirmAction').and.callFake(() => accion$);
      crear({
        title: 'Eliminar',
        message: 'Se eliminará el organismo.',
        confirmText: 'Eliminar',
        confirmAction,
        // El texto que se muestra es siempre propio: acá lo pone la pantalla, a partir del error.
        errorDeAccion: (err) => (err as { motivo: string }).motivo,
        ...extra,
      });
      document.body.appendChild(fixture.nativeElement);
    }

    afterEach(() => {
      fixture.componentInstance.cancelar();
      (fixture.nativeElement as HTMLElement).remove();
    });

    it('en reposo "Confirmar" no está ocupado ni deshabilitado', () => {
      crearEnDocumento();

      expect(botonConfirmar().disabled).toBeFalse();
      expect(botonConfirmar().hasAttribute('aria-disabled')).toBeFalse();
      expect(botonConfirmar().hasAttribute('aria-busy')).toBeFalse();
    });

    it('mientras corre: el botón conserva el foco y se anuncia ocupado, sin `disabled` nativo', () => {
      crearEnDocumento({ busyText: 'Eliminando…' });
      botonConfirmar().focus();

      botonConfirmar().click();
      fixture.detectChanges();

      expect(document.activeElement).toBe(botonConfirmar());
      expect(botonConfirmar().disabled).toBeFalse();
      expect(botonConfirmar().getAttribute('aria-disabled')).toBe('true');
      expect(botonConfirmar().getAttribute('aria-busy')).toBe('true');
      expect(botonConfirmar().textContent).toContain('Eliminando…');
    });

    it('mientras corre se ve no disponible (clase global `.is-unavailable`); en reposo y tras un fallo, no', () => {
      crearEnDocumento();
      expect(botonConfirmar().classList).not.toContain('is-unavailable');

      botonConfirmar().click();
      fixture.detectChanges();
      expect(botonConfirmar().classList).toContain('is-unavailable');

      accion$.error({ motivo: 'Falló.' });
      fixture.detectChanges();
      expect(botonConfirmar().classList).not.toContain('is-unavailable');
    });

    it('Escape o un clic afuera mientras corre no cierran, pero se avisa por qué y cómo salir', () => {
      crearEnDocumento();
      const aviso = (): HTMLElement | null => fixture.nativeElement.querySelector('[data-aviso="cierre-bloqueado"]');

      // En reposo Escape lo maneja Material (cierra): acá no se avisa nada.
      teclas$.next(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(aviso()).toBeNull();

      botonConfirmar().click();
      fixture.detectChanges();
      expect(aviso()).toBeNull();
      teclas$.next(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();
      expect(aviso()).withContext('otra tecla no avisa').toBeNull();

      teclas$.next(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(aviso()!.getAttribute('role')).toBe('status');
      expect(aviso()!.textContent).toContain('usá "Cancelar" para dejar de esperar');
      expect(dialogRef.close).not.toHaveBeenCalled();

      // Al terminar la acción (acá, con error) el aviso se va.
      accion$.error({ motivo: 'Falló.' });
      fixture.detectChanges();
      expect(aviso()).toBeNull();

      accion$ = new Subject<unknown>();
      botonConfirmar().click();
      afuera$.next(new MouseEvent('click'));
      fixture.detectChanges();
      expect(aviso()).withContext('el clic afuera también avisa').not.toBeNull();
    });

    it('mientras corre: otro clic u otro Enter no repiten la acción', () => {
      crearEnDocumento();
      botonConfirmar().focus();

      botonConfirmar().click();
      fixture.detectChanges();
      botonConfirmar().click();
      botonConfirmar().click();

      expect(confirmAction).toHaveBeenCalledTimes(1);
    });

    it('si la acción falla: el foco sigue en "Confirmar", que vuelve a estar disponible para reintentar', () => {
      crearEnDocumento();
      botonConfirmar().focus();
      botonConfirmar().click();
      fixture.detectChanges();

      accion$.error({ motivo: 'No se puede eliminar: tiene trámites.' });
      fixture.detectChanges();

      expect(document.activeElement).toBe(botonConfirmar());
      expect(botonConfirmar().hasAttribute('aria-disabled')).toBeFalse();
      expect(botonConfirmar().hasAttribute('aria-busy')).toBeFalse();
      expect(dialogRef.disableClose).toBeFalse();

      botonConfirmar().click();
      expect(confirmAction).toHaveBeenCalledTimes(2);
    });

    it('el motivo del fallo se anuncia: aparece en un `role="alert"` que no existía antes', () => {
      crearEnDocumento();
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();

      botonConfirmar().click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();

      accion$.error({ motivo: 'No se puede eliminar: tiene trámites.' });
      fixture.detectChanges();

      const alerta = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
      expect(alerta.textContent).toContain('No se puede eliminar: tiene trámites.');
    });

    it('al reintentar el aviso se desmonta, así un segundo fallo se vuelve a anunciar', () => {
      crearEnDocumento();
      botonConfirmar().click();
      accion$.error({ motivo: 'Primer fallo.' });
      fixture.detectChanges();
      const primera = fixture.nativeElement.querySelector('[role="alert"]');

      // Un Subject que ya falló vuelve a fallar al suscribirse: el reintento necesita uno nuevo.
      accion$ = new Subject<unknown>();
      botonConfirmar().click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();

      accion$.error({ motivo: 'Segundo fallo.' });
      fixture.detectChanges();

      const segunda = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
      expect(segunda).not.toBe(primera);
      expect(segunda.textContent).toContain('Segundo fallo.');
    });

    it('sin `confirmAction` (consumidores de siempre): confirma y cierra con `true`', () => {
      crear({ title: 'Salir', message: '¿Salir sin guardar?' });

      (fixture.nativeElement.querySelector('button[mat-flat-button]') as HTMLButtonElement).click();

      expect(dialogRef.close).toHaveBeenCalledOnceWith(true);
    });
  });
});
