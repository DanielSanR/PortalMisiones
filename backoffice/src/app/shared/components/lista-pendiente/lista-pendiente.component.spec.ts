import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { ListaPendienteComponent } from './lista-pendiente.component';

@Component({
  standalone: true,
  imports: [ListaPendienteComponent],
  template: `
    <button type="button" appListaPendiente="ordenar"></button>
    <button type="button" appListaPendiente="exportar"></button>
    <button type="button" appListaPendiente="mas-filtros"></button>
  `,
})
class AnfitrionComponent {}

describe('ListaPendienteComponent', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;
  let botones: HTMLButtonElement[];
  const motivo = (indice: number): string =>
    fixture.debugElement.queryAll(By.css('button'))[indice].injector.get(MatTooltip).message;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AnfitrionComponent], providers: [provideNoopAnimations()] });
    fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
    botones = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  });

  it('"Ordenar" y "Exportar a CSV" son botones de ícono con su nombre accesible', () => {
    expect(botones[0].className).toContain('list-iconbtn');
    expect(botones[0].getAttribute('aria-label')).toBe('Ordenar');
    expect(botones[0].querySelector('i.ph-arrows-down-up[aria-hidden="true"]')).not.toBeNull();
    expect(botones[1].className).toContain('list-iconbtn');
    expect(botones[1].getAttribute('aria-label')).toBe('Exportar a CSV');
    expect(botones[1].querySelector('i.ph-download-simple[aria-hidden="true"]')).not.toBeNull();
  });

  it('"Más filtros" es un botón con texto, sin `aria-label` que lo pise', () => {
    expect(botones[2].className).toContain('list-ghost-button');
    expect(botones[2].hasAttribute('aria-label')).toBeFalse();
    expect(botones[2].textContent!.trim()).toBe('Más filtros');
    expect(botones[2].querySelector('i.ph-sliders-horizontal')).not.toBeNull();
  });

  it('se ven y se anuncian como no disponibles, siguen en el orden de tabulación y dicen por qué', () => {
    for (const boton of botones) {
      expect(boton.getAttribute('aria-disabled')).toBe('true');
      expect(boton.classList.contains('is-unavailable')).toBeTrue();
      expect(boton.disabled).toBeFalse();
    }
    expect(motivo(0)).toBe('Usá los encabezados de la tabla para ordenar; el orden avanzado todavía no está disponible');
    expect(motivo(1)).toBe('La exportación a CSV se habilita cuando el backend ofrezca el endpoint');
    expect(motivo(2)).toBe('Se habilita cuando haya más campos por los que filtrar');
  });

  it('el clic queda anulado (no envía un formulario ni activa nada por defecto)', () => {
    const clic = new MouseEvent('click', { bubbles: true, cancelable: true });
    botones[1].dispatchEvent(clic);
    expect(clic.defaultPrevented).toBeTrue();
  });
});
