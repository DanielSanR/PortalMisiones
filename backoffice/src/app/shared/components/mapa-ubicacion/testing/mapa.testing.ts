import { Provider } from '@angular/core';
import { HOJA_DEL_MAPA, TILES_DEL_MAPA, TilesDelMapa } from '../mapa-ubicacion.component';

/** Tiles sin red para specs: un PNG de 1×1 que carga siempre. */
export const TILES_SIN_RED: TilesDelMapa = {
  url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  atribucion: '&copy; OpenStreetMap',
};

/** Tiles que fallan sin red (lo que pasa cuando una CSP no permite el servidor): disparan `tileerror`. */
export const TILES_ROTOS: TilesDelMapa = { url: 'data:image/png;base64,AAAA', atribucion: '&copy; OpenStreetMap' };

/**
 * Para el spec de una pantalla que dibuja `app-mapa-ubicacion`: Leaflet real, pero ningún pedido a OpenStreetMap ni
 * a la hoja `mapa.css` (que Karma no sirve). En `providers` del módulo de prueba, o uno por uno con
 * `TestBed.overrideProvider` (`TILES_DEL_MAPA`, `HOJA_DEL_MAPA`) cuando el módulo lo arma otro helper.
 */
export function proveerMapaSinRed(tiles: TilesDelMapa = TILES_SIN_RED): Provider[] {
  return [{ provide: TILES_DEL_MAPA, useValue: tiles }, { provide: HOJA_DEL_MAPA, useValue: null }];
}
