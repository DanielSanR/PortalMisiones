import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NEVER, throwError } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

/**
 * El diálogo es OnPush y su estado cambia en callbacks async (timer, finalize, error de la
 * acción): sin `markForCheck` el error o el aviso de demora quedarían sin pintarse.
 */
describe('ConfirmDialogComponent — acción async con OnPush', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  const dialogRef = { close: jasmine.createSpy('close'), disableClose: false };

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

  it('muestra el error de la acción y deja el diálogo abierto', () => {
    crear({
      title: 'Eliminar',
      message: 'Se eliminará el organismo.',
      confirmText: 'Eliminar',
      confirmAction: () => throwError(() => ({ error: { message: 'No se puede eliminar: tiene trámites.' } })),
    });

    fixture.componentInstance.confirmar();
    fixture.detectChanges();

    expect(texto()).toContain('No se puede eliminar: tiene trámites.');
    expect(dialogRef.close).not.toHaveBeenCalled();
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
});
