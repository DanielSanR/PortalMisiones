import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ATAJOS_STORAGE_KEY, AtajosService } from './atajos.service';

function teclear(key: string, opts: KeyboardEventInit = {}, target: EventTarget = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  target.dispatchEvent(event);
  return event;
}

describe('AtajosService', () => {
  let service: AtajosService;
  let dialogs: unknown[];
  let limpiar: Array<() => void>;
  const crear = <T extends HTMLElement>(tag: string, attrs: Record<string, string> = {}): T => {
    const el = document.createElement(tag) as T;
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.textContent = 'x';
    document.body.appendChild(el);
    limpiar.push(() => el.remove());
    return el;
  };

  beforeEach(() => {
    localStorage.removeItem(ATAJOS_STORAGE_KEY);
    dialogs = [];
    limpiar = [];
    TestBed.configureTestingModule({
      providers: [{ provide: MatDialog, useValue: { get openDialogs() { return dialogs; } } }],
    });
    service = TestBed.inject(AtajosService);
  });

  afterEach(() => {
    limpiar.forEach((fn) => fn());
    localStorage.removeItem(ATAJOS_STORAGE_KEY);
  });

  it('dispara la acción de la tecla registrada y previene el evento', () => {
    const accion = jasmine.createSpy('accion');
    service.registrar({ teclas: ['n', '+'], descripcion: 'Nuevo', accion });
    expect(teclear('n').defaultPrevented).toBeTrue();
    teclear('N');
    teclear('+', { shiftKey: true });
    expect(accion).toHaveBeenCalledTimes(3);
  });

  it('no previene el evento si no hay atajo para esa tecla', () => {
    service.registrar({ teclas: ['n'], descripcion: 'Nuevo', accion: () => undefined });
    expect(teclear('x').defaultPrevented).toBeFalse();
  });

  it('no dispara con foco en campos editables', () => {
    const accion = jasmine.createSpy('accion');
    service.registrar({ teclas: ['n'], descripcion: 'Nuevo', accion });
    const objetivos = [
      crear('input'), crear('textarea'), crear('select'), crear('mat-select'),
      crear('div', { contenteditable: 'true' }), crear('div', { role: 'combobox' }), crear('div', { role: 'textbox' }),
    ];
    objetivos.forEach((el) => teclear('n', {}, el));
    expect(accion).not.toHaveBeenCalled();
  });

  it('no dispara con Ctrl/Alt/Meta, con Shift sobre letras, repeat ni composición IME', () => {
    const accion = jasmine.createSpy('accion');
    service.registrar({ teclas: ['n'], descripcion: 'Nuevo', accion });
    teclear('n', { ctrlKey: true });
    teclear('n', { altKey: true });
    teclear('n', { metaKey: true });
    teclear('N', { shiftKey: true });
    teclear('n', { repeat: true });
    teclear('n', { isComposing: true });
    expect(accion).not.toHaveBeenCalled();
  });

  it('admite Shift en teclas que lo requieren ("?")', () => {
    const accion = jasmine.createSpy('accion');
    service.registrar({ teclas: ['?'], descripcion: 'Ayuda', accion });
    teclear('?', { shiftKey: true });
    expect(accion).toHaveBeenCalledTimes(1);
  });

  it('no dispara con un diálogo abierto', () => {
    const accion = jasmine.createSpy('accion');
    service.registrar({ teclas: ['n'], descripcion: 'Nuevo', accion });
    dialogs.push({});
    teclear('n');
    expect(accion).not.toHaveBeenCalled();
  });

  it('no dispara con un overlay con backdrop activo (menú)', () => {
    const accion = jasmine.createSpy('accion');
    service.registrar({ teclas: ['n'], descripcion: 'Nuevo', accion });
    crear('div', { class: 'cdk-overlay-backdrop cdk-overlay-backdrop-showing' });
    teclear('n');
    expect(accion).not.toHaveBeenCalled();
  });

  it('con atajos apagados ninguna tecla dispara y listar() queda vacío', () => {
    const accion = jasmine.createSpy('accion');
    service.registrar({ teclas: ['/'], descripcion: 'Buscar', accion });
    service.setHabilitados(false);
    teclear('/');
    expect(accion).not.toHaveBeenCalled();
    expect(service.listar()).toEqual([]);
    service.setHabilitados(true);
    teclear('/');
    expect(accion).toHaveBeenCalledTimes(1);
  });

  it('desregistrar quita el atajo', () => {
    const accion = jasmine.createSpy('accion');
    const quitar = service.registrar({ teclas: ['n'], descripcion: 'Nuevo', accion });
    quitar();
    teclear('n');
    expect(accion).not.toHaveBeenCalled();
  });

  it('si dos elementos comparten tecla gana el último conectado y visible', () => {
    const a = jasmine.createSpy('a');
    const b = jasmine.createSpy('b');
    const elA = crear<HTMLButtonElement>('button');
    const elB = crear<HTMLButtonElement>('button');
    service.registrar({ teclas: ['n'], descripcion: 'A', accion: a, elemento: elA });
    service.registrar({ teclas: ['n'], descripcion: 'B', accion: b, elemento: elB });
    teclear('n');
    expect(b).toHaveBeenCalledTimes(1);
    expect(service.listar().map((x) => x.descripcion)).toEqual(['B']);
    elB.remove();
    teclear('n');
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('ignora elementos deshabilitados o aria-disabled', () => {
    const accion = jasmine.createSpy('accion');
    const el = crear<HTMLButtonElement>('button', { 'aria-disabled': 'true' });
    service.registrar({ teclas: ['n'], descripcion: 'Nuevo', accion, elemento: el });
    teclear('n');
    el.removeAttribute('aria-disabled');
    el.disabled = true;
    teclear('n');
    expect(accion).not.toHaveBeenCalled();
    expect(service.listar()).toEqual([]);
  });

  describe('preferencia', () => {
    it('es encendida por defecto y se persiste en localStorage', () => {
      let valor: boolean | undefined;
      service.habilitados$.subscribe((v) => (valor = v));
      expect(valor).toBeTrue();
      service.setHabilitados(false);
      expect(valor).toBeFalse();
      expect(localStorage.getItem(ATAJOS_STORAGE_KEY)).toBe('0');
    });

    it('se lee apagada al crear el servicio', () => {
      localStorage.setItem(ATAJOS_STORAGE_KEY, '0');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [{ provide: MatDialog, useValue: { openDialogs: [] } }] });
      expect(TestBed.inject(AtajosService).habilitados).toBeFalse();
    });

    it('tolera un localStorage que falla', () => {
      spyOn(Storage.prototype, 'setItem').and.throwError('lleno');
      expect(() => service.setHabilitados(false)).not.toThrow();
      expect(service.habilitados).toBeFalse();
    });
  });
});
