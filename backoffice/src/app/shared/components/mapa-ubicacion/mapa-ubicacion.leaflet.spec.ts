import { APP_VERSION } from '@core/constants/app-info.constants';
import {
  HOJA_DEL_MAPA_POR_DEFECTO, PASO_LARGO_PX, PASO_PX, cargarHojaDelMapa, desplazamientoDeTecla, moduloDeLeaflet,
} from './mapa-ubicacion.leaflet';

describe('mapa-ubicacion.leaflet (piezas sin estado)', () => {
  describe('desplazamientoDeTecla', () => {
    const tecla = (key: string, shiftKey = false): KeyboardEvent => new KeyboardEvent('keydown', { key, shiftKey });

    it('cada flecha mueve un paso en su dirección (en píxeles de pantalla: arriba es y negativo)', () => {
      expect(desplazamientoDeTecla(tecla('ArrowUp'))).toEqual([0, -PASO_PX]);
      expect(desplazamientoDeTecla(tecla('ArrowDown'))).toEqual([0, PASO_PX]);
      expect(desplazamientoDeTecla(tecla('ArrowLeft'))).toEqual([-PASO_PX, 0]);
      expect(desplazamientoDeTecla(tecla('ArrowRight'))).toEqual([PASO_PX, 0]);
    });

    it('con Mayúscula, el paso largo; otra tecla no mueve nada', () => {
      expect(desplazamientoDeTecla(tecla('ArrowRight', true))).toEqual([PASO_LARGO_PX, 0]);
      expect(desplazamientoDeTecla(tecla('Enter'))).toBeNull();
    });
  });

  describe('moduloDeLeaflet', () => {
    const L = { map: () => null };

    it('acepta el módulo con las funciones sueltas o todo bajo `default` (build de producción, UMD)', () => {
      expect(moduloDeLeaflet(L)).toBe(L as never);
      expect(moduloDeLeaflet({ default: L })).toBe(L as never);
    });
  });

  describe('cargarHojaDelMapa', () => {
    afterEach(() => document.head.querySelectorAll('link[data-hoja-del-mapa]').forEach((l) => l.remove()));

    it('agrega UN solo <link> de la hoja (mismo origen) y resuelve cuando carga', async () => {
      const primera = cargarHojaDelMapa(document, 'mapa-de-prueba.css');
      const segunda = cargarHojaDelMapa(document, 'mapa-de-prueba.css');
      const links = document.head.querySelectorAll<HTMLLinkElement>('link[data-hoja-del-mapa]');
      expect(links.length).toBe(1);
      expect(links[0].rel).toBe('stylesheet');
      expect(links[0].getAttribute('href')).toBe('mapa-de-prueba.css');

      links[0].dispatchEvent(new Event('load'));
      await expectAsync(Promise.all([primera, segunda])).toBeResolved();
      // Ya cargada: la próxima vez resuelve en el acto.
      await expectAsync(cargarHojaDelMapa(document, 'mapa-de-prueba.css')).toBeResolved();
    });

    it('si la hoja falla (sin red) quita el <link> y rechaza; la próxima apertura la vuelve a pedir', async () => {
      const carga = cargarHojaDelMapa(document, 'no-existe.css');
      const otra = cargarHojaDelMapa(document, 'no-existe.css');
      document.head.querySelector('link[data-hoja-del-mapa]')!.dispatchEvent(new Event('error'));
      await expectAsync(carga).toBeRejected();
      await expectAsync(otra).toBeRejected();
      expect(document.head.querySelector('link[data-hoja-del-mapa]')).toBeNull();

      const reintento = cargarHojaDelMapa(document, 'no-existe.css');
      const nuevo = document.head.querySelectorAll('link[data-hoja-del-mapa]');
      expect(nuevo.length).toBe(1);
      nuevo[0].dispatchEvent(new Event('load'));
      await expectAsync(reintento).toBeResolved();
    });

    it('la hoja por defecto se pide con la versión de la app (el bundle con nombre no lleva hash)', () => {
      expect(HOJA_DEL_MAPA_POR_DEFECTO).toBe(`mapa.css?v=${encodeURIComponent(APP_VERSION)}`);
    });

    it('sin hoja (`null`, specs) no agrega nada', async () => {
      await expectAsync(cargarHojaDelMapa(document, null)).toBeResolved();
      expect(document.head.querySelector('link[data-hoja-del-mapa]')).toBeNull();
    });
  });
});
