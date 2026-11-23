import { canonicalizarSlug } from '@core/utils/slug.utils';
import { FichaFormData, FichaLocal } from '../models/ficha-local.vm';

/**
 * Reglas de validación de una ficha por localidad. Funciones puras (hoja): no conocen el formulario; devuelven
 * la CLAVE del error (o `null`), y la pantalla pone el texto.
 */

/** Largo máximo del slug (la columna es VARCHAR sin largo, pero el slug va en una URL). */
export const MAX_SLUG = 255;

/** Una URL absoluta http(s), sin espacios. */
const PATRON_URL = /^https?:\/\/[^\s/$.?#][^\s]*$/i;

/** Lo ya ocupado por las demás fichas del alcance (ver `FichaFormData.ocupadas`). */
export type FichasOcupadas = FichaFormData['ocupadas'];

export type ErrorDeUrl = 'urlEsquema' | 'urlEspacios' | 'urlIncompleta';
export type ErrorDeLocalidad = 'localidadOcupada' | 'localidadDesactivada';

/** El slug tiene que dejar algo después de canonicalizarlo ("¡¡¡" no sirve). Vacío no cuenta: es de `required`. */
export function slugSinContenido(slug: string): boolean {
  return !!slug.trim() && !canonicalizarSlug(slug);
}

/** El slug (canonicalizado) ya lo usa otra ficha, activa o desactivada. */
export function slugRepetido(slug: string, ocupadas: FichasOcupadas): boolean {
  const canonico = canonicalizarSlug(slug);
  return !!canonico && ocupadas.slugs.includes(canonico);
}

/**
 * La URL tiene que ser absoluta http(s) y sin espacios. Cada forma de no cumplirlo tiene su error, para que el
 * mensaje diga QUÉ corregir (también en una URL guardada de antes que hoy no pasaría): le falta el `https://`,
 * tiene espacios, o no hay un sitio después del `https://`. Vacía es válida (es opcional).
 */
export function errorDeUrl(url: string): ErrorDeUrl | null {
  const valor = url.trim();
  if (!valor) return null;
  if (!/^https?:\/\//i.test(valor)) return 'urlEsquema';
  if (/\s/.test(valor)) return 'urlEspacios';
  return PATRON_URL.test(valor) ? null : 'urlIncompleta';
}

/** ¿La localidad ya tiene una ficha (activa o desactivada) en esta adopción? */
export function localidadOcupada(localidadId: string, ocupadas: FichasOcupadas): boolean {
  return ocupadas.localidadIds.includes(localidadId);
}

/** ¿La ficha que ocupa la localidad está desactivada? Entonces no se crea otra: se reactiva esa. */
export function localidadOcupadaPorDesactivada(localidadId: string, ocupadas: FichasOcupadas): boolean {
  return ocupadas.localidadIdsDesactivadas.includes(localidadId);
}

/**
 * Alta: la localidad elegida ya tiene ficha de esta adopción. El backend tiene UNIQUE (adopción, localidad) y lo
 * rechaza con un 500 sin detalle; si la que la ocupa está desactivada, el error lo dice (se reactiva esa).
 */
export function errorDeLocalidad(localidadId: string, ocupadas: FichasOcupadas): ErrorDeLocalidad | null {
  if (!localidadId || !localidadOcupada(localidadId, ocupadas)) return null;
  return localidadOcupadaPorDesactivada(localidadId, ocupadas) ? 'localidadDesactivada' : 'localidadOcupada';
}

/**
 * Reactivar (en edición) una ficha desactivada cuya localidad ya tiene otra ficha activa de la misma adopción
 * dejaría dos activas. Solo puede pasar con duplicados anteriores al UNIQUE del backend. Si la otra también está
 * desactivada, reactivar esta no deja dos activas.
 */
export function reactivacionDuplicada(ficha: Pick<FichaLocal, 'activa' | 'localidadId'>, ocupadas: FichasOcupadas): boolean {
  if (ficha.activa || !ficha.localidadId) return false;
  return localidadOcupada(ficha.localidadId, ocupadas) && !localidadOcupadaPorDesactivada(ficha.localidadId, ocupadas);
}
