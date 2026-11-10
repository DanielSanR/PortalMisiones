import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormActionsComponent } from './form-actions.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, FormActionsComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="envios = envios + 1">
      <app-form-actions [saving]="saving" [sinCambios]="sinCambios" [apariencia]="apariencia"
          helpText="Ayuda" submitText="Crear" (cancelar)="cancelaciones = cancelaciones + 1"></app-form-actions>
    </form>`,
})
class HostComponent {
  form = new FormGroup({ nombre: new FormControl('') });
  saving = false;
  sinCambios = false;
  apariencia: 'raised' | 'flat' = 'raised';
  envios = 0;
  cancelaciones = 0;
}

describe('FormActionsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const el = (selector: string): HTMLElement => fixture.nativeElement.querySelector(selector);
  const submit = (): HTMLButtonElement => el('button[type="submit"]') as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent, NoopAnimationsModule] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('el botón de envío dispara el ngSubmit del formulario que lo contiene', () => {
    submit().click();
    expect(host.envios).toBe(1);
  });

  it('"Cancelar" no envía el formulario', () => {
    (el('button[type="button"]') as HTMLButtonElement).click();
    expect(host.cancelaciones).toBe(1);
    expect(host.envios).toBe(0);
  });

  it('sin cambios: botón deshabilitado y envoltorio focusable para leer el motivo', () => {
    expect(el('.form-actions__submit').getAttribute('tabindex')).toBeNull();

    host.sinCambios = true;
    fixture.detectChanges();

    expect(submit().disabled).toBeTrue();
    expect(el('.form-actions__submit').getAttribute('tabindex')).toBe('0');
  });

  it('guardando: deshabilita los dos botones y conserva un texto en el de envío', () => {
    host.saving = true;
    host.sinCambios = true;
    fixture.detectChanges();

    expect(submit().disabled).toBeTrue();
    expect((el('button[type="button"]') as HTMLButtonElement).disabled).toBeTrue();
    expect(submit().getAttribute('aria-busy')).toBe('true');
    expect(submit().textContent).toContain('Guardando');
    // El motivo del bloqueo ya no es "sin cambios": el envoltorio deja de ser focusable.
    expect(el('.form-actions__submit').getAttribute('tabindex')).toBeNull();
  });

  it('respeta la variante de botón de cada pantalla', () => {
    expect(submit().hasAttribute('mat-raised-button')).toBeTrue();

    host.apariencia = 'flat';
    fixture.detectChanges();

    expect(submit().hasAttribute('mat-flat-button')).toBeTrue();
  });
});
