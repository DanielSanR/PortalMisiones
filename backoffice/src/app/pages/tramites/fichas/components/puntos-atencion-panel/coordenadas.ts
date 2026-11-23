/** Decimales que guarda la base (`NUMERIC(9,6)`). */
export const MAX_DECIMALES = 6;

/**
 * Texto → número. Acepta coma o punto decimal (es-AR escribe "-27,3671") y espacios alrededor.
 * Devuelve `null` si no es un número.
 */
export function parsearCoordenada(texto: string | null | undefined): number | null {
  const limpio = String(texto ?? '').trim().replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Cantidad de decimales tal como se escribió (sin contar ceros que el número pierde). */
function decimalesEscritos(texto: string): number {
  const [, decimales = ''] = texto.trim().replace(',', '.').split('.');
  return decimales.length;
}

/** Qué tiene de malo una coordenada escrita a mano. */
export type ErrorDeCoordenada = 'numero' | 'rango' | 'decimales';

/**
 * Regla de una coordenada escrita a mano (P-8): número, dentro de `[min, max]` y con hasta 6 decimales.
 * Vacío lo cubre el obligatorio del campo. Devuelve qué falla, o `null`.
 */
export function errorDeCoordenada(texto: string | null | undefined, min: number, max: number): ErrorDeCoordenada | null {
  const escrito = String(texto ?? '');
  if (!escrito.trim()) return null;
  const n = parsearCoordenada(escrito);
  if (n === null) return 'numero';
  if (n < min || n > max) return 'rango';
  if (decimalesEscritos(escrito) > MAX_DECIMALES) return 'decimales';
  return null;
}

/** Número → texto del input, con coma decimal (es-AR). */
export function formatearCoordenada(valor: number | null): string {
  return valor === null ? '' : String(valor).replace('.', ',');
}

/** Link "Ver en mapa" de OpenStreetMap, centrado y con marcador en las coordenadas. */
export function urlMapa(latitud: number, longitud: number): string {
  const lat = encodeURIComponent(String(latitud));
  const lon = encodeURIComponent(String(longitud));
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}
