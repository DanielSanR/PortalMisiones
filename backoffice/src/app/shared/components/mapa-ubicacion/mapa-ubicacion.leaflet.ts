import type * as Leaflet from 'leaflet';
import { APP_VERSION } from '@core/constants/app-info.constants';
import { Coordenadas, EncuadreDeMapa } from '@core/models/ubicacion.model';

/**
 * Piezas de Leaflet del mapa de ubicación, sin estado: el ícono del marcador, la cuenta de un paso con el
 * teclado y cómo se aplica un encuadre. Solo TIPOS de Leaflet acá: la librería se baja en diferido
 * (`import('leaflet')` en el componente) y llega como argumento.
 */
export type LeafletModulo = typeof Leaflet;

/** Zoom al mostrar un punto ya marcado (calle y número a la vista). */
export const ZOOM_DE_PUNTO = 17;

/** Píxeles que mueve el marcador cada flecha (con Mayúscula, `PASO_LARGO_PX`). */
export const PASO_PX = 8;
export const PASO_LARGO_PX = 48;

/** Sin tiles cargados después de esto, el mapa se da por no disponible (CSP, red, servidor caído). */
export const ESPERA_TILES_MS = 10000;
/** Tiles fallidos (sin ninguno cargado) para darlo por no disponible antes de la espera. */
export const ERRORES_TILES_MAX = 3;

/**
 * Pin propio (SVG, colores del tema por clase) en vez de los PNG de Leaflet: esos se rompen con el bundler y
 * pedirían assets aparte. Borde claro + relleno primario: contrasta ≥ 3:1 sobre calles claras y sobre zonas verdes.
 */
const PIN_SVG =
  '<svg class="mapa-ubicacion__pin" viewBox="0 0 32 42" width="32" height="42" aria-hidden="true" focusable="false">'
  + '<path class="mapa-ubicacion__pin-borde" d="M16 1C7.7 1 1 7.6 1 15.8 1 27 16 41 16 41s15-14 15-25.2C31 7.6 24.3 1 16 1z"/>'
  + '<circle class="mapa-ubicacion__pin-centro" cx="16" cy="15.5" r="5.5"/></svg>';

/** `fijo`: de solo lectura (sin cursor de arrastre). Los estilos están en `shared-styles/mapa-leaflet.scss`. */
export function iconoDelMarcador(L: LeafletModulo, fijo: boolean): Leaflet.DivIcon {
  const className = fijo ? 'mapa-ubicacion__marcador is-fijo' : 'mapa-ubicacion__marcador';
  return L.divIcon({ className, html: PIN_SVG, iconSize: [32, 42], iconAnchor: [16, 41] });
}

/**
 * Hoja del mapa (CSS de Leaflet + marcador): el bundle `mapa.css` de `angular.json`. Un bundle con nombre no
 * lleva hash en el build, así que se pide con la versión de la app (`APP_VERSION`): tras un release el
 * navegador no reusa la hoja vieja de su caché.
 */
export const HOJA_DEL_MAPA_POR_DEFECTO = `mapa.css?v=${encodeURIComponent(APP_VERSION)}`;
/** Espera máxima de la hoja antes de dibujar igual (si no llega a tiempo, el mapa se ve sin estilos pero anda). */
const ESPERA_HOJA_MS = 4000;

/**
 * Agrega una sola vez el `<link rel="stylesheet">` de la hoja del mapa y espera a que cargue (o pase
 * `ESPERA_HOJA_MS`). Va en un bundle aparte para que Leaflet no pese en los estilos globales; mismo origen, así
 * que la CSP (`style-src 'self'`) lo permite. `null` = no agregar nada (specs).
 *
 * Si la hoja FALLA (sin red) rechaza, y el mapa muestra su aviso en vez de dibujarse sin estilos; el `<link>`
 * fallido se quita para que la próxima apertura lo vuelva a pedir (si quedara, cada apertura esperaría un `load`
 * que ya no llega).
 */
export function cargarHojaDelMapa(documento: Document, href: string | null): Promise<void> {
  if (!href) return Promise.resolve();
  const existente = documento.head.querySelector<HTMLLinkElement>('link[data-hoja-del-mapa]');
  if (existente?.dataset['cargada'] === 'si') return Promise.resolve();
  const link = existente ?? documento.createElement('link');
  if (!existente) {
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset['hojaDelMapa'] = '';
    documento.head.appendChild(link);
  }
  return new Promise((resolver, rechazar) => {
    const terminar = (): void => {
      clearTimeout(espera);
      link.removeEventListener('load', alCargar);
      link.removeEventListener('error', alFallar);
    };
    const alCargar = (): void => {
      terminar();
      link.dataset['cargada'] = 'si';
      resolver();
    };
    const alFallar = (): void => {
      terminar();
      link.remove();
      rechazar(new Error('No cargó la hoja del mapa.'));
    };
    // Pasada la espera se dibuja igual; los oyentes siguen: si la hoja llega tarde queda marcada como cargada, y si
    // falla se quita para reintentar la próxima vez.
    const espera = setTimeout(resolver, ESPERA_HOJA_MS);
    link.addEventListener('load', alCargar);
    link.addEventListener('error', alFallar);
  });
}

/**
 * Leaflet 1.9 se publica como UMD (CommonJS): según el empaquetador, `import('leaflet')` entrega las funciones
 * sueltas (`map`, `marker`…) o todo bajo `default` (así lo arma esbuild en el build de producción). Devuelve el
 * módulo usable en los dos casos.
 */
export function moduloDeLeaflet(importado: unknown): LeafletModulo {
  const conDefault = importado as { default?: LeafletModulo } & Partial<LeafletModulo>;
  return typeof conDefault.map === 'function' ? (importado as LeafletModulo) : (conDefault.default as LeafletModulo);
}

export function aLatLng(L: LeafletModulo, punto: Coordenadas): Leaflet.LatLng {
  return L.latLng(punto.latitud, punto.longitud);
}

export function aCoordenadas(latlng: Leaflet.LatLng): Coordenadas {
  return { latitud: latlng.lat, longitud: latlng.lng };
}

/** Flechas → desplazamiento en píxeles de pantalla. `null` si no es una flecha. */
export function desplazamientoDeTecla(evento: KeyboardEvent): [number, number] | null {
  const paso = evento.shiftKey ? PASO_LARGO_PX : PASO_PX;
  switch (evento.key) {
    case 'ArrowUp': return [0, -paso];
    case 'ArrowDown': return [0, paso];
    case 'ArrowLeft': return [-paso, 0];
    case 'ArrowRight': return [paso, 0];
    default: return null;
  }
}

/** El punto que queda a `[dx, dy]` píxeles de `desde`, al zoom actual del mapa. */
export function moverEnPixeles(mapa: Leaflet.Map, desde: Leaflet.LatLng, [dx, dy]: [number, number]): Leaflet.LatLng {
  const zoom = mapa.getZoom();
  const p = mapa.project(desde, zoom);
  return mapa.unproject([p.x + dx, p.y + dy], zoom);
}

/**
 * Muestra el encuadre de una vez, sin animar: cambia el zoom, y un zoom animado de Leaflet deja un temporizador
 * que `remove()` no cancela (ver `quitarMapa`).
 */
export function aplicarEncuadre(L: LeafletModulo, mapa: Leaflet.Map, encuadre: EncuadreDeMapa): void {
  if ('centro' in encuadre) {
    mapa.setView(aLatLng(L, encuadre.centro), encuadre.zoom, { animate: false });
    return;
  }
  const { suroeste, noreste } = encuadre.limites;
  mapa.fitBounds(L.latLngBounds(aLatLng(L, suroeste), aLatLng(L, noreste)), { animate: false });
}

/** Lo que dura el zoom animado de Leaflet (su temporizador de fin es de 250 ms), con margen. */
export const FIN_DEL_ZOOM_MS = 300;

/**
 * Destruye el mapa sin poder lanzar. `stop()` corta un paneo o un vuelo; un zoom animado YA arrancado no lo corta
 * nadie: Leaflet deja un `setTimeout` de 250 ms que, si el mapa ya se quitó, lee los paneles borrados y lanza un
 * `TypeError`. Con `zoomEnCurso` el mapa (ya fuera del documento) termina su zoom y se quita después.
 */
export function quitarMapa(mapa: Leaflet.Map, zoomEnCurso: boolean): void {
  const quitar = (): void => {
    try {
      mapa.remove();
    } catch {
      // Ya quitado, o el contenedor lo tomó otra instancia: no queda nada que soltar.
    }
  };
  try {
    mapa.stop();
  } catch {
    // Un mapa a medio armar puede no tener vista todavía: se quita igual.
  }
  if (zoomEnCurso) setTimeout(quitar, FIN_DEL_ZOOM_MS);
  else quitar();
}

/** Botones de zoom con nombre en español (los de Leaflet dicen "Zoom in" / "Zoom out": WCAG 3.1.2). */
export function controlDeZoom(L: LeafletModulo): Leaflet.Control.Zoom {
  return L.control.zoom({ zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' });
}

/** Prefijo de la atribución: solo el nombre de la librería (sin la bandera que agrega Leaflet) y el aviso de pestaña nueva. */
export const PREFIJO_DE_ATRIBUCION =
  '<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet'
  + '<span class="cdk-visually-hidden"> (se abre en una pestaña nueva)</span></a>';
