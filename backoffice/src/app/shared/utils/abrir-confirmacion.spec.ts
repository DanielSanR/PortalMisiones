import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { abrirConfirmacion } from './abrir-confirmacion';

@Component({ standalone: true, template: 'otro' })
class OtroDialogComponent {}

describe('abrirConfirmacion', () => {
  let dialog: MatDialog;
  const data = { title: 'Título', message: 'Mensaje' };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MatDialogModule, NoopAnimationsModule, OtroDialogComponent] });
    dialog = TestBed.inject(MatDialog);
  });

  afterEach(() => dialog.closeAll());

  it('abre una confirmación con el panelClass por defecto', () => {
    abrirConfirmacion(dialog, { data }).subscribe();
    expect(dialog.openDialogs.length).toBe(1);
    expect(dialog.openDialogs[0].componentInstance.constructor.name).toBe('ConfirmDialogComponent');
    expect(dialog.openDialogs[0]._containerInstance._config.panelClass).toBe('custom-modal-panel');
  });

  it('con una confirmación abierta no abre otra y completa sin emitir', () => {
    abrirConfirmacion(dialog, { data }).subscribe();
    let emitio = false;
    let completo = false;
    abrirConfirmacion(dialog, { data }).subscribe({ next: () => (emitio = true), complete: () => (completo = true) });
    expect(dialog.openDialogs.length).toBe(1);
    expect(emitio).toBeFalse();
    expect(completo).toBeTrue();
  });

  it('con un diálogo que no es confirmación abierto sí abre', () => {
    dialog.open(OtroDialogComponent);
    abrirConfirmacion(dialog, { data }).subscribe();
    expect(dialog.openDialogs.length).toBe(2);
  });
});
