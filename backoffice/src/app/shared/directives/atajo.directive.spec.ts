import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { ATAJOS_STORAGE_KEY, AtajosService } from '../../core/services/atajos.service';
import { AtajoDirective } from './atajo.directive';

@Component({
  standalone: true,
  imports: [AtajoDirective],
  template: `
    @if (mostrar) {
      <button id="nuevo" appAtajo="n" (click)="clicks = clicks + 1">Nuevo usuario</button>
    }
    <button id="bloqueado" appAtajo="b" aria-disabled="true" (click)="clicks = clicks + 1">Bloqueado</button>
    <input id="buscar" appAtajo="f" atajoDescripcion="Buscar en la lista" />
    <input id="apagado" [appAtajo]="tecla" />
  `,
})
class HostComponent {
  clicks = 0;
  mostrar = true;
  tecla: string | null = null;
}

function teclear(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
  return event;
}

describe('AtajoDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let servicio: AtajosService;
  const el = <T extends HTMLElement>(id: string) => fixture.nativeElement.querySelector('#' + id) as T;

  beforeEach(() => {
    localStorage.removeItem(ATAJOS_STORAGE_KEY);
    TestBed.configureTestingModule({
      imports: [HostComponent, NoopAnimationsModule],
      providers: [{ provide: MatDialog, useValue: { openDialogs: [] } }],
    });
    servicio = TestBed.inject(AtajosService);
    fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    localStorage.removeItem(ATAJOS_STORAGE_KEY);
  });

  it('hace click sobre el botón con N y con su alias +', () => {
    teclear('n');
    teclear('+');
    expect(fixture.componentInstance.clicks).toBe(2);
  });

  it('hace focus sobre un campo con F', () => {
    const e = teclear('f');
    expect(document.activeElement).toBe(el('buscar'));
    expect(e.defaultPrevented).toBeTrue();
  });

  it('no dispara si el host está aria-disabled', () => {
    teclear('b');
    expect(fixture.componentInstance.clicks).toBe(0);
  });

  it('expone aria-keyshortcuts y no pisa el aria-label ni inventa tooltip en campos', () => {
    expect(el('nuevo').getAttribute('aria-keyshortcuts')).toBe('N Plus');
    expect(el('buscar').getAttribute('aria-keyshortcuts')).toBe('F');
    expect(el('apagado').hasAttribute('aria-keyshortcuts')).toBeFalse();
  });

  it('lista la descripción del texto del host o del input', () => {
    const lista = servicio.listar().map((a) => a.descripcion);
    expect(lista).toContain('Nuevo usuario');
    expect(lista).toContain('Buscar en la lista');
    expect(lista).not.toContain('Bloqueado');
  });

  it('con una tecla recibida más tarde por @Input se registra', () => {
    fixture.componentInstance.tecla = 'g';
    fixture.detectChanges();
    teclear('g');
    expect(document.activeElement).toBe(el('apagado'));
  });

  it('se desregistra al destruirse el host (sin botón no hay atajo)', () => {
    fixture.componentInstance.mostrar = false;
    fixture.detectChanges();
    teclear('n');
    expect(fixture.componentInstance.clicks).toBe(0);
    expect(servicio.listar().map((a) => a.teclas[0])).not.toContain('n');
  });

  it('con atajos apagados no dispara y quita aria-keyshortcuts', () => {
    servicio.setHabilitados(false);
    teclear('n');
    expect(fixture.componentInstance.clicks).toBe(0);
    expect(el('nuevo').hasAttribute('aria-keyshortcuts')).toBeFalse();
  });
});
