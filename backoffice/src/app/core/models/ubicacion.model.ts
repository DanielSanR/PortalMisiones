/**
 * Un punto en el mapa (WGS84, grados decimales). Lo comparten el mapa interactivo
 * (`shared/components/mapa-ubicacion`) y la geocodificación (`@features/geocodificacion`).
 */
export interface Coordenadas {
  latitud: number;
  longitud: number;
}

/**
 * Qué muestra el mapa cuando no hay un punto marcado: un centro con su zoom (una localidad) o un rectángulo
 * que tiene que entrar entero (la provincia).
 */
export type EncuadreDeMapa =
  | { centro: Coordenadas; zoom: number }
  | { limites: { suroeste: Coordenadas; noreste: Coordenadas } };

/** Provincia de Misiones, con un margen chico: la vista por defecto cuando no se sabe nada mejor. */
export const ENCUADRE_MISIONES: EncuadreDeMapa = {
  limites: {
    suroeste: { latitud: -28.17, longitud: -56.07 },
    noreste: { latitud: -25.49, longitud: -53.63 },
  },
};

/** Decimales con los que se guardan las coordenadas (`NUMERIC(9,6)`: ~11 cm). */
export const DECIMALES_DE_COORDENADA = 6;

/** Redondea a 6 decimales sin arrastrar el error de coma flotante. */
export function redondearCoordenadas(punto: Coordenadas): Coordenadas {
  const r = (n: number): number => Number(n.toFixed(DECIMALES_DE_COORDENADA));
  return { latitud: r(punto.latitud), longitud: r(punto.longitud) };
}

/** Las dos coordenadas son iguales a 6 decimales (lo que se guarda). */
export function mismasCoordenadas(a: Coordenadas | null, b: Coordenadas | null): boolean {
  if (!a || !b) return a === b;
  const x = redondearCoordenadas(a);
  const y = redondearCoordenadas(b);
  return x.latitud === y.latitud && x.longitud === y.longitud;
}
