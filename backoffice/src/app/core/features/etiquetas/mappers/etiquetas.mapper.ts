import { Etiqueta } from '@core/models/tramite.model';
import { EtiquetaVM } from '../models/etiqueta.vm';

/**
 * Mapea el modelo mock (`Etiqueta`) al VM. Cuando el backend exponga el endpoint, se reemplaza
 * la fuente por un DTO real y este mapper se ajusta sin tocar facade/componentes.
 */
export function toEtiquetaVM(e: Etiqueta): EtiquetaVM {
  return {
    id: e.id,
    nombre: e.nombre,
    slug: e.slug,
    icono: e.icono,
    color: e.color,
    activo: e.activo,
    tramitesCount: e.tramitesCount ?? 0,
  };
}
