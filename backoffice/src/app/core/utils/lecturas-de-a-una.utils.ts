import { Observable, catchError, from, map, mergeMap, of, tap, toArray } from 'rxjs';

/** Lecturas sueltas (`GET /{id}`) en paralelo, como mucho: un listado con muchos ids no abre N conexiones. */
export const CONCURRENCIA_DE_LECTURAS = 4;

/** Qué hacer con cada lectura de {@link leerDeAUno}. */
export interface RecuerdoDeLecturas<T> {
  /** Recibe cada lectura que salió, y `null` para un fallo definitivo (no se reintenta). */
  recordar: (id: string, valor: T | null) => void;
  /** Fallo que no se arregla reintentando (un 404 o un 403): se recuerda como `null`. El resto no se recuerda. */
  esDefinitivo: (err: unknown) => boolean;
}

/**
 * Orquestación de I/O (no es una regla de dominio): lee `ids` de a uno, de a `CONCURRENCIA_DE_LECTURAS` por vez,
 * y entrega cada resultado a `recordar`. Un fallo no tumba el resto: un fallo definitivo se recuerda como `null`;
 * cualquier otro (conexión, 5xx) no se recuerda, para volver a probar en la próxima lectura. Completa con un solo
 * `void` cuando terminaron todas (de inmediato si no hay ids). Lo usa `FichasLocalesFacade` para los nombres de
 * adopciones y plantillas que no vienen en los listados.
 */
export function leerDeAUno<T>(
  ids: string[],
  leer: (id: string) => Observable<T>,
  { recordar, esDefinitivo }: RecuerdoDeLecturas<T>,
): Observable<void> {
  if (!ids.length) return of(void 0);
  return from(ids).pipe(
    mergeMap((id) => leer(id).pipe(
      tap((valor) => recordar(id, valor)),
      catchError((err: unknown) => {
        if (esDefinitivo(err)) recordar(id, null);
        return of(null);
      }),
    ), CONCURRENCIA_DE_LECTURAS),
    toArray(),
    map(() => void 0),
  );
}
