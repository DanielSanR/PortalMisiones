/**
 * Textos que se mandan a geocodificar. Se agrega la provincia y el país para que el servicio no confunda
 * "San Martín 123" con cualquier otra del país; la localidad de la ficha va si se la conoce.
 */
export const SUFIJO_PROVINCIA = 'Misiones, Argentina';

/** Recorta y colapsa espacios. */
function limpiar(texto: string | null | undefined): string {
  return String(texto ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * "Av. Uruguay 3150" + "Posadas" → "Av. Uruguay 3150, Posadas, Misiones, Argentina". Si la dirección ya dice una
 * localidad después de una coma ("Av. Uruguay 3150, Posadas"), manda esa y no agrega la de la ficha (la persona
 * sabe mejor dónde queda la oficina). Sin dirección no hay consulta (`''`).
 */
export function consultaDeDireccion(direccion: string | null | undefined, localidad: string | null | undefined): string {
  const dir = limpiar(direccion);
  if (!dir) return '';
  const traeLocalidad = dir.includes(',');
  return [dir, traeLocalidad ? '' : limpiar(localidad), SUFIJO_PROVINCIA].filter(Boolean).join(', ');
}

/** "Oberá" → "Oberá, Misiones, Argentina". Sin localidad, `''`. */
export function consultaDeLocalidad(localidad: string | null | undefined): string {
  const loc = limpiar(localidad);
  return loc ? `${loc}, ${SUFIJO_PROVINCIA}` : '';
}
