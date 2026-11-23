/** Textos de la ubicación del punto de atención (búsqueda por dirección y mapa). */

export const TEXTO_AYUDA_UBICAR = 'Escribí la dirección y tocá «Ubicar en el mapa», o marcá el punto directamente en el mapa.';

export const TEXTO_BUSCAR_SIN_DIRECCION = 'Escribí la dirección del punto para ubicarla en el mapa.';

export const TEXTO_SIN_RESULTADOS = 'No encontramos esa dirección. Ubicá el punto en el mapa o cargá las coordenadas.';

export const TEXTO_BUSQUEDA_FALLIDA =
  'No pudimos buscar la dirección en este momento. Ubicá el punto en el mapa o cargá las coordenadas.';

export const TEXTO_GEOCODIFICACION_NO_DISPONIBLE =
  'La búsqueda por dirección no está habilitada en este entorno. Marcá el punto en el mapa o cargá las coordenadas.';

/** Sin mapa. «Abrir en OpenStreetMap» aparece recién con las dos coordenadas válidas: el texto lo condiciona a eso. */
export const TEXTO_SIN_MAPA =
  'Podés cargar las coordenadas a mano; cuando estén completas, verificalas con «Abrir en OpenStreetMap».';

export const TEXTO_ALTERNATIVA = '¿Ya tenés las coordenadas? Escribilas en Latitud y Longitud: el marcador se mueve solo.';

/**
 * Qué se encontró. Con uno: dónde quedó el marcador. Con varios: que el primero ya está marcado y se puede elegir otro.
 * Siempre invita a revisar: la geocodificación ubica la cuadra, no siempre la puerta.
 */
export function textoDeResultados(cantidad: number, elegido: string): string {
  return cantidad === 1
    ? `Ubicamos «${elegido}». Revisá que el marcador quede en la puerta y movelo si hace falta.`
    : `Encontramos ${cantidad} lugares y marcamos «${elegido}». Si no es ese, elegí otro de la lista.`;
}
