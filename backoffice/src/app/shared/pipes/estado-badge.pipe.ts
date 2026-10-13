import { Pipe, PipeTransform } from '@angular/core';
import { TramiteEstado } from '../../core/models/tramite.model';
import { ETIQUETA_ESTADO_PUBLICACION, EstadoPublicacion } from '../../core/models/estado-publicacion.model';

/**
 * Estados que entiende el badge: los del mock viejo de trámites (minúsculas, se va en la fase 5) y
 * los del backend (`PublicationStatus` de las fichas por localidad).
 */
export type EstadoBadge = TramiteEstado | EstadoPublicacion;

/** Clave visual del estado: la que usan los tokens `--theme-estado-*` y `data-estado`. */
export type ClaveEstadoBadge = TramiteEstado;

const CLAVES: Record<EstadoBadge, ClaveEstadoBadge> = {
  borrador: 'borrador',
  revision: 'revision',
  publicado: 'publicado',
  despublicado: 'despublicado',
  BORRADOR: 'borrador',
  EN_REVISION: 'revision',
  PUBLICADO: 'publicado',
  DESPUBLICADO: 'despublicado',
};

const LABELS: Record<ClaveEstadoBadge, string> = {
  borrador: ETIQUETA_ESTADO_PUBLICACION.BORRADOR,
  revision: ETIQUETA_ESTADO_PUBLICACION.EN_REVISION,
  publicado: ETIQUETA_ESTADO_PUBLICACION.PUBLICADO,
  despublicado: ETIQUETA_ESTADO_PUBLICACION.DESPUBLICADO,
};

/** Normaliza cualquiera de las dos formas a la clave visual (o `null` si no es un estado conocido). */
export function claveDeEstado(estado: EstadoBadge | null | undefined): ClaveEstadoBadge | null {
  return estado ? CLAVES[estado] ?? null : null;
}

@Pipe({ name: 'estadoBadge', standalone: true })
export class EstadoBadgePipe implements PipeTransform {
  transform(estado: EstadoBadge): string {
    const clave = claveDeEstado(estado);
    return clave ? LABELS[clave] : estado;
  }
}
