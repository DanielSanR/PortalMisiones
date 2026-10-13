import { Pipe, PipeTransform } from '@angular/core';
import { ETIQUETA_ESTADO_PUBLICACION, EstadoPublicacion } from '../../core/models/estado-publicacion.model';

/** Estado que entiende el badge: el `PublicationStatus` del backend (fichas por localidad). */
export type EstadoBadge = EstadoPublicacion;

/** Clave visual del estado: la que usan los tokens `--theme-estado-*` y `data-estado`. */
export type ClaveEstadoBadge = 'borrador' | 'revision' | 'publicado' | 'despublicado';

const CLAVES: Record<EstadoBadge, ClaveEstadoBadge> = {
  BORRADOR: 'borrador',
  EN_REVISION: 'revision',
  PUBLICADO: 'publicado',
  DESPUBLICADO: 'despublicado',
};

/** Traduce el estado a la clave visual (o `null` si no es un estado conocido). */
export function claveDeEstado(estado: EstadoBadge | null | undefined): ClaveEstadoBadge | null {
  return estado ? CLAVES[estado] ?? null : null;
}

@Pipe({ name: 'estadoBadge', standalone: true })
export class EstadoBadgePipe implements PipeTransform {
  transform(estado: EstadoBadge): string {
    return ETIQUETA_ESTADO_PUBLICACION[estado] ?? estado;
  }
}
