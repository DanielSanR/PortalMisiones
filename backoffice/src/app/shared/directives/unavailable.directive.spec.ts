import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { MOTIVO_NO_DISPONIBLE, UnavailableDirective } from './unavailable.directive';

@Component({
  standalone: true,
  imports: [UnavailableDirective],
  template: `
    <button id="normal" appUnavailable="Motivo propio">Normal</button>
    <button id="visible" appUnavailable="Motivo propio" appUnavailableMotivoVisible
            aria-describedby="ayuda">Visible</button>
    <p id="ayuda">Motivo propio</p>
    <button id="alterna" [appUnavailable]="motivo" (click)="clics = clics + 1">Alterna</button>
    <button id="suelto" appUnavailable>Suelto</button>
  `,
})
class HostComponent {
  motivo: string | false | null | undefined = false;
  clics = 0;
}

describe('UnavailableDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  const tooltipDe = (id: string): MatTooltip =>
    fixture.debugElement.query(By.css('#' + id)).injector.get(MatTooltip);
  const boton = (id: string): HTMLButtonElement => fixture.nativeElement.querySelector('#' + id);

  beforeEach(fakeAsync(() => {
    TestBed.configureTestingModule({ imports: [HostComponent, NoopAnimationsModule] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    flushMicrotasks();
  }));

  it('por defecto el motivo va en el tooltip y es focusable con aria-disabled', () => {
    expect(tooltipDe('normal').message).toBe('Motivo propio');
    expect(boton('normal').getAttribute('aria-disabled')).toBe('true');
    expect(boton('normal').disabled).toBeFalse();
  });

  it('con appUnavailableMotivoVisible no hay tooltip: el motivo lo da solo el aria-describedby del host', () => {
    expect(tooltipDe('visible').message).toBe('');
    expect(boton('visible').getAttribute('aria-describedby')).toBe('ayuda');
    expect(boton('visible').getAttribute('aria-disabled')).toBe('true');
  });

  it('el clic sigue anulado aunque el motivo esté a la vista', () => {
    const evento = new MouseEvent('click', { bubbles: true, cancelable: true });
    boton('visible').dispatchEvent(evento);

    expect(evento.defaultPrevented).toBeTrue();
  });

  it('el atributo suelto (o un motivo vacío) sigue siendo "no disponible" con el motivo por defecto', () => {
    expect(tooltipDe('suelto').message).toBe(MOTIVO_NO_DISPONIBLE);
    expect(boton('suelto').getAttribute('aria-disabled')).toBe('true');

    for (const vacio of ['', '  ', undefined]) {
      fixture.componentInstance.motivo = vacio;
      fixture.detectChanges();
      expect(tooltipDe('alterna').message).toBe(MOTIVO_NO_DISPONIBLE);
      expect(boton('alterna').getAttribute('aria-disabled')).toBe('true');
    }
  });

  describe('alternar sobre el mismo elemento', () => {
    const fijar = (motivo: string | false | null): void => {
      fixture.componentInstance.motivo = motivo;
      fixture.detectChanges();
    };

    it('con `false` o `null` el control está disponible: sin `aria-disabled`, sin clase, sin tooltip, y el clic pasa', () => {
      for (const disponible of [false, null] as const) {
        fijar('Motivo');
        fijar(disponible);
        fixture.componentInstance.clics = 0;

        expect(boton('alterna').getAttribute('aria-disabled')).toBeNull();
        expect(boton('alterna').classList).not.toContain('is-unavailable');
        expect(tooltipDe('alterna').message).toBe('');
        const evento = new MouseEvent('click', { bubbles: true, cancelable: true });
        boton('alterna').dispatchEvent(evento);
        expect(evento.defaultPrevented).toBeFalse();
        expect(fixture.componentInstance.clics).toBe(1);
      }
    });

    it('al llegar un motivo vuelve a bloquear el clic y a explicarlo', () => {
      fijar('Sin cambios');

      expect(boton('alterna').getAttribute('aria-disabled')).toBe('true');
      expect(boton('alterna').classList).toContain('is-unavailable');
      expect(tooltipDe('alterna').message).toBe('Sin cambios');
      // Ni el `(click)` del propio control en su template llega a correr.
      boton('alterna').click();
      expect(fixture.componentInstance.clics).toBe(0);
    });

    it('el elemento es siempre el mismo y conserva el foco al cambiar de estado', () => {
      document.body.append(fixture.nativeElement);
      const nodo = boton('alterna');
      nodo.focus();

      fijar('Sin cambios');
      expect(boton('alterna')).toBe(nodo);
      expect(document.activeElement).toBe(nodo);

      fijar(false);
      expect(document.activeElement).toBe(nodo);
      fixture.nativeElement.remove();
    });
  });
});
