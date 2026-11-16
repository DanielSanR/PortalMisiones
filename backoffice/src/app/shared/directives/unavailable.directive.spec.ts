import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { UnavailableDirective } from './unavailable.directive';

@Component({
  standalone: true,
  imports: [UnavailableDirective],
  template: `
    <button id="normal" appUnavailable="Motivo propio">Normal</button>
    <button id="visible" appUnavailable="Motivo propio" appUnavailableMotivoVisible
            aria-describedby="ayuda">Visible</button>
    <p id="ayuda">Motivo propio</p>
  `,
})
class HostComponent {}

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
});
