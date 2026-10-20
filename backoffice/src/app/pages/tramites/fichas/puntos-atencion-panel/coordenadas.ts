import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

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

/**
 * Validador de una coordenada escrita a mano (P-8): número, dentro de `[min, max]` y con hasta 6
 * decimales. Vacío lo cubre `required`. Errores: `numero`, `rango` (`{ min, max }`), `decimales`.
 */
export function coordenadaValida(min: number, max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const texto = String(control.value ?? '');
    if (!texto.trim()) return null;
    const n = parsearCoordenada(texto);
    if (n === null) return { numero: true };
    if (n < min || n > max) return { rango: { min, max } };
    if (decimalesEscritos(texto) > MAX_DECIMALES) return { decimales: { max: MAX_DECIMALES } };
    return null;
  };
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
