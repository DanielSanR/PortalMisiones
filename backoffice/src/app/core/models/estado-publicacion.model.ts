/**
 * Estado de publicación de una ficha por localidad: enum `PublicationStatus` del backend
 * (`origin/dev` @ `23fd8f9`), verbatim. Vive en `core/models` porque lo comparten el feature
 * `fichas-locales` y el badge de `shared` (que no puede depender de un feature).
 */
export type EstadoPublicacion = 'BORRADOR' | 'EN_REVISION' | 'PUBLICADO' | 'DESPUBLICADO';

/** Los cuatro estados, en el orden del workflow (para selects y tablas). */
export const ESTADOS_PUBLICACION: readonly EstadoPublicacion[] = ['BORRADOR', 'EN_REVISION', 'PUBLICADO', 'DESPUBLICADO'];

/** Etiqueta visible de cada estado. */
export const ETIQUETA_ESTADO_PUBLICACION: Record<EstadoPublicacion, string> = {
  BORRADOR: 'Borrador',
  EN_REVISION: 'En revisión',
  PUBLICADO: 'Publicado',
  DESPUBLICADO: 'Despublicado',
};
