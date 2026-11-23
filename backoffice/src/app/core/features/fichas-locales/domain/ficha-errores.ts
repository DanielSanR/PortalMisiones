import { FichaLocalVM } from '../models/ficha-local.vm';

/**
 * COMPATIBILIDAD TEMPORAL (backend anterior a `586b670`): el servidor no entregó el contenido de la ficha
 * (adopción, localidad…), así que no hay base sobre la que armar el PUT. El facade se niega a guardarla:
 * un reemplazo total con campos vacíos borraría lo que está guardado.
 */
export class FichaSinContenidoError extends Error {
  constructor() {
    super('El servidor no entregó el contenido de la ficha: no se puede guardar.');
    this.name = 'FichaSinContenidoError';
  }
}

/**
 * La ficha cambió en el servidor (otra versión u otro estado) desde que el formulario la leyó. El facade lo
 * detecta releyéndola justo antes del PUT y NO guarda: la pantalla decide si recargar o pisar igual.
 */
export class FichaCambiadaError extends Error {
  /** La ficha tal como está ahora en el servidor. */
  constructor(readonly actual: FichaLocalVM) {
    super('La ficha cambió en el servidor desde que se abrió el formulario.');
    this.name = 'FichaCambiadaError';
  }
}

/**
 * El PUT se guardó, pero el segundo paso (el `DELETE` que despublica una ficha que quedó `PUBLICADO` e
 * inactiva) falló. No es "no se pudo guardar": los cambios están persistidos.
 */
export class DespublicacionFallidaError extends Error {
  /** La ficha tal como la dejó el PUT (sigue `PUBLICADO` e inactiva). */
  constructor(readonly ficha: FichaLocalVM) {
    super('Los cambios se guardaron, pero no se pudo despublicar la ficha.');
    this.name = 'DespublicacionFallidaError';
  }
}
