import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTooltip } from '@angular/material/tooltip';
import { FormActionsComponent } from './form-actions.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, FormActionsComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="envios = envios + 1">
      <app-form-actions [saving]="saving" [sinCambios]="sinCambios"
          [helpText]="ayuda" [integrada]="integrada" submitText="Crear" (cancelar)="cancelaciones = cancelaciones + 1">
        @if (conInfo) {
          <span formActionsInfo class="indicador">Falta algo</span>
        }
      </app-form-actions>
    </form>`,
})
class HostComponent {
  form = new FormGroup({ nombre: new FormControl('') });
  saving = false;
  sinCambios = false;
  ayuda = 'Ayuda';
  integrada = false;
  conInfo = false;
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

  describe('sin cambios', () => {
    beforeEach(() => {
      host.sinCambios = true;
      fixture.detectChanges();
    });

    it('con cambios el botón no lleva `aria-disabled` ni la clase de no disponible', () => {
      host.sinCambios = false;
      fixture.detectChanges();

      expect(submit().getAttribute('aria-disabled')).toBeNull();
      expect(submit().classList).not.toContain('is-unavailable');
      expect(submit().disabled).toBeFalse();
    });

    it('el botón se anuncia no disponible con `aria-disabled`, sin `disabled` nativo', () => {
      expect(submit().getAttribute('aria-disabled')).toBe('true');
      expect(submit().classList).toContain('is-unavailable');
      expect(submit().disabled).toBeFalse();
      expect(submit().textContent).toContain('Crear');
    });

    it('sigue en el orden de tabulación: recibe el foco él, no un envoltorio', () => {
      document.body.append(fixture.nativeElement);
      submit().focus();

      expect(document.activeElement).toBe(submit());
      expect(el('.form-actions__submit').getAttribute('tabindex')).toBeNull();
      fixture.nativeElement.remove();
    });

    it('el motivo queda asociado al botón (tooltip de `appUnavailable`)', () => {
      const tooltip = fixture.debugElement.query(By.css('button[type="submit"]')).injector.get(MatTooltip);
      expect(tooltip.message).toBe('No hay cambios para guardar');
    });

    it('el clic no envía el formulario', () => {
      submit().click();
      expect(host.envios).toBe(0);
    });

    it('Enter o Espacio sobre el botón tampoco lo envían', () => {
      for (const key of ['Enter', ' ']) {
        const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        submit().dispatchEvent(evento);
        expect(evento.defaultPrevented).toBeTrue();
      }
      expect(host.envios).toBe(0);
    });

    it('al aparecer un cambio vuelve a enviar', () => {
      host.sinCambios = false;
      fixture.detectChanges();

      submit().click();
      expect(host.envios).toBe(1);
    });
  });

  it('guardando: deshabilita los dos botones y conserva un texto en el de envío', () => {
    host.saving = true;
    host.sinCambios = true;
    fixture.detectChanges();

    expect(submit().disabled).toBeTrue();
    expect((el('button[type="button"]') as HTMLButtonElement).disabled).toBeTrue();
    expect(submit().getAttribute('aria-busy')).toBe('true');
    expect(submit().textContent).toContain('Guardando');
    // El motivo del bloqueo ya no es "sin cambios": es un guardado en curso, no un "no disponible".
    expect(submit().getAttribute('aria-disabled')).toBeNull();
  });

  describe('foco: el botón de envío es siempre el mismo nodo (WCAG 2.4.3)', () => {
    /** Un cuadro de render: el navegador reubica el foco de un control que dejó de ser enfocable recién ahí. */
    const cuadro = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

    beforeEach(() => document.body.append(fixture.nativeElement));
    afterEach(() => fixture.nativeElement.remove());

    it('guardar y quedarse en la página (el form vuelve a "sin cambios") deja el foco en el mismo botón', async () => {
      const boton = submit();
      boton.focus();

      host.saving = true;
      fixture.detectChanges();
      await cuadro();
      host.saving = false;
      host.sinCambios = true;
      fixture.detectChanges();
      await cuadro();

      expect(submit()).toBe(boton);
      expect(document.activeElement).toBe(boton);
      expect(boton.getAttribute('aria-disabled')).toBe('true');
    });

    it('con el foco en el botón no disponible, el primer cambio lo habilita sin sacarle el foco', async () => {
      host.sinCambios = true;
      fixture.detectChanges();
      const boton = submit();
      boton.focus();

      host.sinCambios = false;
      fixture.detectChanges();
      await cuadro();

      expect(submit()).toBe(boton);
      expect(document.activeElement).toBe(boton);
      expect(boton.getAttribute('aria-disabled')).toBeNull();
    });
  });

  it('el botón de envío es plano, igual que en los diálogos', () => {
    expect(submit().hasAttribute('mat-flat-button')).toBeTrue();
  });

  it('integrada: suma el modificador del pie de tarjeta; por defecto es la barra de siempre', () => {
    expect(el('.form-actions').classList).not.toContain('form-actions--integrada');

    host.integrada = true;
    fixture.detectChanges();

    expect(el('.form-actions').classList).toContain('form-actions--integrada');
  });

  it('proyecta el indicador a la izquierda y sin ayuda no deja un hueco vacío', () => {
    host.conInfo = true;
    host.ayuda = '';
    fixture.detectChanges();

    expect(el('.form-actions__info .indicador').textContent).toContain('Falta algo');
    expect(el('.form-actions__help')).toBeNull();
  });
});
