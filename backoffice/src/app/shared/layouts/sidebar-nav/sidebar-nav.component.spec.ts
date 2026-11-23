import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { NavGroup } from '@core/constants/role-mapping.constants';
import { ResultadoBuscador } from './buscador-comandos';
import { SidebarNavComponent } from './sidebar-nav.component';

const GRUPOS: NavGroup[] = [
  {
    label: 'Contenidos',
    items: [
      { label: 'Organismos', icon: 'buildings', route: '/dashboard/organismos' },
      { label: 'Organigrama', icon: 'tree-structure', route: '/dashboard/organigrama' },
    ],
  },
  { label: 'Administración', items: [{ label: 'Usuarios', icon: 'users', route: '/dashboard/usuarios' }] },
];

describe('SidebarNavComponent — buscador de comandos y nav de la sidebar', () => {
  let fixture: ComponentFixture<SidebarNavComponent>;
  let el: HTMLElement;
  let elegidos: ResultadoBuscador[];

  const input = (): HTMLInputElement => el.querySelector<HTMLInputElement>('input.admin-layout__search-input')!;
  const opciones = (): HTMLElement[] => Array.from(el.querySelectorAll<HTMLElement>('#nav-resultados [role=option]'));
  const textos = (selector: string): string[] =>
    Array.from(el.querySelectorAll<HTMLElement>(selector)).map((nodo) => nodo.textContent?.trim() ?? '');

  function escribir(texto: string): void {
    input().value = texto;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function tecla(key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    input().dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarNavComponent],
      providers: [provideRouter([]), provideNoopAnimations()],
    }).compileComponents();
    fixture = TestBed.createComponent(SidebarNavComponent);
    fixture.componentRef.setInput('grupos', GRUPOS);
    elegidos = [];
    fixture.componentInstance.ejecutar.subscribe((resultado) => elegidos.push(resultado));
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('en reposo dibuja los grupos con sus secciones y el buscador cerrado', () => {
    expect(textos('.admin-layout__nav-group-label')).toEqual(['Contenidos', 'Administración']);
    expect(textos('a.admin-layout__nav-item')).toEqual(['Organismos', 'Organigrama', 'Usuarios']);
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(input().getAttribute('aria-controls')).toBeNull();
    expect(el.querySelector('#nav-resultados')).toBeNull();
  });

  it('colapsar un grupo oculta sus secciones y lo informa con aria-expanded', () => {
    const encabezado = el.querySelector<HTMLButtonElement>('button.admin-layout__nav-group-header')!;

    encabezado.click();
    fixture.detectChanges();

    expect(encabezado.getAttribute('aria-expanded')).toBe('false');
    expect(textos('a.admin-layout__nav-item')).toEqual(['Usuarios']);
  });

  it('al escribir, el nav se convierte en los resultados y el primero queda bajo el cursor', () => {
    escribir('organi');

    expect(opciones().map((o) => o.textContent?.trim())).toEqual(['Organismos', 'Organigrama']);
    expect(el.querySelector('a.admin-layout__nav-item')).toBeNull();
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(input().getAttribute('aria-controls')).toBe('nav-resultados');
    expect(input().getAttribute('aria-activedescendant')).toBe('resultado-0');
    expect(opciones()[0].getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector('[role=status]')?.textContent?.trim()).toBe('2 resultados');
  });

  it('las flechas recorren los resultados en ronda sin sacar el foco del campo', fakeAsync(() => {
    escribir('organi');

    const abajo = tecla('ArrowDown');
    tick();
    expect(abajo.defaultPrevented).toBeTrue();
    expect(input().getAttribute('aria-activedescendant')).toBe('resultado-1');
    expect(opciones()[1].classList).toContain('is-cursor');

    tecla('ArrowDown');
    tick();
    expect(input().getAttribute('aria-activedescendant')).toBe('resultado-0');

    tecla('ArrowUp');
    tick();
    expect(input().getAttribute('aria-activedescendant')).toBe('resultado-1');
  }));

  it('Enter avisa el resultado bajo el cursor y deja el buscador limpio, con el nav de vuelta', () => {
    escribir('usuarios');

    tecla('Enter');

    expect(elegidos).toEqual([{ tipo: 'nav', label: 'Usuarios', icon: 'users', route: '/dashboard/usuarios' }]);
    expect(input().value).toBe('');
    expect(el.querySelector('#nav-resultados')).toBeNull();
    expect(textos('.admin-layout__nav-group-label')).toEqual(['Contenidos', 'Administración']);
  });

  it('el clic en un resultado lo avisa igual que Enter', () => {
    escribir('organi');

    opciones()[1].click();
    fixture.detectChanges();

    expect(elegidos.map((r) => r.label)).toEqual(['Organigrama']);
    expect(input().value).toBe('');
  });

  it('sin coincidencias lo dice con el texto buscado', () => {
    escribir('zzz');

    expect(el.querySelector('.admin-layout__nav-empty')?.textContent?.trim()).toBe('Sin resultados para "zzz".');
    expect(input().getAttribute('aria-activedescendant')).toBeNull();
  });

  it('Escape con texto limpia la búsqueda y no llega al menú; con el campo vacío sigue de largo', () => {
    const alMenu = jasmine.createSpy('escapeEnElMenu');
    el.addEventListener('keydown', alMenu);

    escribir('organi');
    tecla('Escape');
    expect(alMenu).not.toHaveBeenCalled();
    expect(input().value).toBe('');
    expect(el.querySelector('#nav-resultados')).toBeNull();

    tecla('Escape');
    expect(alMenu).toHaveBeenCalledTimes(1);
  });

  it('el clic en una sección del nav avisa `navegado` (el shell cierra el menú en mobile)', () => {
    const navegado = jasmine.createSpy('navegado');
    fixture.componentInstance.navegado.subscribe(navegado);
    const link = el.querySelector<HTMLAnchorElement>('a.admin-layout__nav-item')!;
    // Solo interesa el aviso: se evita que el router navegue de verdad.
    link.addEventListener('click', (event) => event.preventDefault());

    link.click();

    expect(navegado).toHaveBeenCalledTimes(1);
  });

  it('`enfocarBuscador` (atajo "/") deja el foco en el campo', fakeAsync(() => {
    document.body.appendChild(el);

    fixture.componentInstance.enfocarBuscador();
    tick();

    expect(document.activeElement).toBe(input());
    el.remove();
  }));
});
