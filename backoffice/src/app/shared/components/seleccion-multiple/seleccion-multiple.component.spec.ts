import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { OpcionSeleccion, SeleccionMultipleComponent } from './seleccion-multiple.component';

const CATALOGO: OpcionSeleccion[] = Array.from({ length: 10 }, (_, i) => ({ id: `id-${i + 1}`, nombre: `Opción ${i + 1}` }));

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, SeleccionMultipleComponent],
  template: `
    <app-seleccion-multiple etiqueta="Categorías" nombre="categorías" textoVacio="Ninguna categoría elegida."
        [opciones]="opciones" [abierto]="abierto" [maxChips]="3" (abiertoChange)="abierto = $event"
        [formControl]="control">
      <p class="proyectado">Hijo proyectado</p>
    </app-seleccion-multiple>`,
})
class HostComponent {
  control = new FormControl<string[]>([], { nonNullable: true });
  opciones = CATALOGO;
  abierto = false;
}

describe('SeleccionMultipleComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const el = (selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector);
  const all = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const chips = (): string[] => all('.seleccion-multiple__chip').map((c) => (c.textContent ?? '').trim());
  const refrescar = (): void => fixture.detectChanges();
  const abrir = (): void => {
    host.abierto = true;
    refrescar();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    refrescar();
  });

  it('sin nada elegido muestra el texto vacío y el contador en 0', () => {
    expect(el('.seleccion-multiple__vacio')?.textContent).toContain('Ninguna categoría elegida.');
    expect(el('.perm-group__count')?.textContent).toContain('0 de 10');
    expect(el('.seleccion-multiple__alternar')?.textContent).toContain('Elegir');
  });

  it('escribir el valor desde el form no emite ni ensucia el control', () => {
    const emitidos: string[][] = [];
    const sub = host.control.valueChanges.subscribe((v) => emitidos.push(v));
    host.control.setValue(['id-1'], { emitEvent: false });
    refrescar();
    expect(chips()).toEqual(['Opción 1']);
    expect(emitidos).toEqual([]);
    expect(host.control.dirty).toBeFalse();
    expect(host.control.touched).toBeFalse();
    sub.unsubscribe();
  });

  it('Enter en el buscador no envía el formulario que lo contiene', () => {
    abrir();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    (el('.seleccion-multiple__busqueda') as HTMLInputElement).dispatchEvent(enter);
    expect(enter.defaultPrevented).toBeTrue();
  });

  it('Escape cierra la lista también con el foco en el botón del grupo', () => {
    abrir();
    (el('.seleccion-multiple__alternar') as HTMLElement)
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    refrescar();
    expect(host.abierto).toBeFalse();
    expect(el('.seleccion-multiple__panel')).toBeNull();
  });

  it('quitar un chip deja el foco en el botón del grupo', () => {
    host.control.setValue(['id-1']);
    refrescar();
    (el('.seleccion-multiple__quitar') as HTMLButtonElement).click();
    refrescar();
    expect(document.activeElement).toBe(el('.seleccion-multiple__alternar'));
  });

  it('quitar un chip con otros elegidos deja el foco en el chip que ocupa su lugar', () => {
    host.control.setValue(['id-1', 'id-2', 'id-3']);
    refrescar();
    (el('.seleccion-multiple__quitar') as HTMLButtonElement).click();
    refrescar();
    const primero = el('.seleccion-multiple__quitar') as HTMLButtonElement;
    expect(primero.getAttribute('aria-label')).toBe('Quitar Opción 2');
    expect(document.activeElement).toBe(primero);
  });

  it('writeValue pinta un chip por id elegido, en el orden del catálogo', () => {
    host.control.setValue(['id-3', 'id-1']);
    refrescar();
    expect(chips()).toEqual(['Opción 1', 'Opción 3']);
    expect(el('.perm-group__count')?.textContent).toContain('2 de 10');
    expect(el('.seleccion-multiple__alternar')?.textContent).toContain('Cambiar');
  });

  it('un id que no está en las opciones se ve como no disponible y se puede quitar', () => {
    host.control.setValue(['fantasma']);
    refrescar();
    expect(chips()).toEqual(['Opción no disponible']);
    (el('.seleccion-multiple__quitar') as HTMLButtonElement).click();
    expect(host.control.value).toEqual([]);
  });

  it('el botón del chip quita ese id y lo marca como tocado', () => {
    host.control.setValue(['id-1', 'id-2']);
    refrescar();
    const quitar = el('.seleccion-multiple__quitar') as HTMLButtonElement;
    expect(quitar.getAttribute('aria-label')).toBe('Quitar Opción 1');
    quitar.click();
    refrescar();
    expect(host.control.value).toEqual(['id-2']);
    expect(host.control.touched).toBeTrue();
    expect(chips()).toEqual(['Opción 2']);
  });

  it('marcar y desmarcar emiten el valor sin reordenar las opciones', () => {
    abrir();
    const nombres = () => all('.seleccion-multiple__opcion').map((o) => (o.textContent ?? '').trim());
    const antes = nombres();
    const casilla = (n: number) => all('.seleccion-multiple__opcion input')[n] as HTMLInputElement;

    casilla(2).click();
    refrescar();
    expect(host.control.value).toEqual(['id-3']);
    casilla(0).click();
    refrescar();
    expect(host.control.value).toEqual(['id-3', 'id-1']);
    casilla(2).click();
    refrescar();
    expect(host.control.value).toEqual(['id-1']);
    expect(nombres()).toEqual(antes);
  });

  it('con más de maxChips elegidos resume el resto en "+N más", que abre el grupo', () => {
    host.control.setValue(['id-1', 'id-2', 'id-3', 'id-4', 'id-5']);
    refrescar();
    expect(chips().length).toBe(3);
    const mas = el('.seleccion-multiple__mas button') as HTMLButtonElement;
    expect(mas.textContent).toContain('+2 más');
    mas.click();
    refrescar();
    expect(host.abierto).toBeTrue();
    expect(el('.seleccion-multiple__panel')).not.toBeNull();
  });

  it('el botón alterna aria-expanded y apunta al panel con aria-controls', () => {
    const boton = el('.seleccion-multiple__alternar') as HTMLButtonElement;
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    boton.click();
    refrescar();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(boton.textContent).toContain('Listo');
    expect(el(`#${boton.getAttribute('aria-controls')}`)).not.toBeNull();
  });

  it('el buscador filtra las opciones y avisa cuando ninguna coincide', () => {
    abrir();
    const buscador = el('.seleccion-multiple__busqueda') as HTMLInputElement;
    expect(buscador.placeholder).toBe('Buscar entre 10…');

    buscador.value = 'opción 10';
    buscador.dispatchEvent(new Event('input'));
    refrescar();
    expect(all('.seleccion-multiple__opcion').length).toBe(1);

    buscador.value = 'zzz';
    buscador.dispatchEvent(new Event('input'));
    refrescar();
    expect(all('.seleccion-multiple__opcion').length).toBe(0);
    const aviso = el('[role="status"]');
    expect(aviso?.textContent).toContain('Ninguna opción coincide con la búsqueda.');
  });

  it('con 8 opciones o menos no ofrece buscador', () => {
    host.opciones = CATALOGO.slice(0, 8);
    refrescar();
    abrir();
    expect(el('.seleccion-multiple__busqueda')).toBeNull();
  });

  it('cerrar la lista marca el control como tocado y descarta la búsqueda', () => {
    abrir();
    const buscador = el('.seleccion-multiple__busqueda') as HTMLInputElement;
    buscador.value = 'zzz';
    buscador.dispatchEvent(new Event('input'));
    refrescar();
    expect(host.control.touched).toBeFalse();

    host.abierto = false;
    refrescar();
    expect(host.control.touched).toBeTrue();
    abrir();
    expect((el('.seleccion-multiple__busqueda') as HTMLInputElement).value).toBe('');
  });

  it('deshabilitado: bloquea el botón, los chips y las casillas', () => {
    host.control.setValue(['id-1']);
    host.control.disable();
    refrescar();
    expect((el('.seleccion-multiple__alternar') as HTMLButtonElement).disabled).toBeTrue();
    expect((el('.seleccion-multiple__quitar') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('proyecta el contenido al final del grupo', () => {
    expect(el('.seleccion-multiple .proyectado')).not.toBeNull();
  });
});
