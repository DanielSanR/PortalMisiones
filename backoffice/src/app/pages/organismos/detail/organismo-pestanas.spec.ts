import { TABS, tabTrasTecla } from './organismo-pestanas';

describe('organismo-pestanas (teclado del tablist, patrón APG)', () => {
  it('las flechas recorren las pestañas y dan la vuelta en los extremos', () => {
    expect(tabTrasTecla('ArrowRight', 'datos')).toBe('tramites');
    expect(tabTrasTecla('ArrowRight', 'historial')).toBe('datos');
    expect(tabTrasTecla('ArrowLeft', 'tramites')).toBe('datos');
    expect(tabTrasTecla('ArrowLeft', 'datos')).toBe('historial');
  });

  it('Inicio y Fin saltan a la primera y a la última', () => {
    expect(tabTrasTecla('Home', 'responsables')).toBe('datos');
    expect(tabTrasTecla('End', 'datos')).toBe('historial');
  });

  it('cualquier otra tecla no es del tablist: no hay destino (y no se frena)', () => {
    expect(tabTrasTecla('Enter', 'datos')).toBeNull();
    expect(tabTrasTecla('Tab', 'datos')).toBeNull();
  });

  it('ningún contador afirma un 0: el backend todavía no expone esos datos', () => {
    expect(TABS.map((t) => t.contador)).toEqual([null, null, null, null]);
  });
});
