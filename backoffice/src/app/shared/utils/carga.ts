import { Observable, OperatorFunction, catchError, map, of, startWith } from 'rxjs';

/**
 * Estado de la carga de lo que muestra una pantalla (un detalle, los datos de un formulario): mientras se
 * pide, si falló (`noExiste`: la entidad no está, reintentar no sirve) o el valor ya resuelto.
 *
 * Se arma con {@link conCarga} y se consume con `async`:
 *
 *   readonly estado$ = this.facade.getDetalle(id).pipe(conCarga(esPlantillaInexistente));
 *
 *   @if (estado$ | async; as estado) {
 *     @if (estado.tipo !== 'ok') {
 *       <app-estado-carga [tipo]="estado.tipo" [noExiste]="estado.tipo === 'error' && estado.noExiste" …></app-estado-carga>
 *     } @else { … estado.valor … }
 *   }
 */
export type Carga<T> =
  | { tipo: 'cargando' }
  | { tipo: 'error'; noExiste: boolean }
  | { tipo: 'ok'; valor: T };

/** Los estados de {@link Carga} que no traen valor: lo que dibuja `app-estado-carga`. */
export type TipoDeCargaPendiente = 'cargando' | 'error';

/** Un valor que ya se tiene (p. ej. el que devolvió el último guardado), sin pasar por "cargando". */
export function cargaLista<T>(valor: T): Carga<T> {
  return { tipo: 'ok', valor };
}

/**
 * Convierte una lectura one-shot en su {@link Carga}: emite `cargando` al suscribirse, después `ok` con el
 * valor o `error`. El error no se propaga (el stream sigue vivo para un reintento aguas arriba).
 *
 * `esInexistente` decide si el error es "esa entidad no existe" (404 / código de negocio): la pantalla lo
 * muestra con texto propio y sin "Reintentar". Sin él, todo error es reintentable.
 */
export function conCarga<T>(esInexistente: (err: unknown) => boolean = () => false): OperatorFunction<T, Carga<T>> {
  return (origen$: Observable<T>) => origen$.pipe(
    map((valor): Carga<T> => ({ tipo: 'ok', valor })),
    catchError((err: unknown) => of<Carga<T>>({ tipo: 'error', noExiste: esInexistente(err) })),
    startWith<Carga<T>>({ tipo: 'cargando' }),
  );
}
