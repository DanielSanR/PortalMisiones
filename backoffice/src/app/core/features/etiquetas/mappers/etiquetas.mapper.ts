import { Etiqueta } from '@core/models/tramite.model';
import { TagRequestDTO, TagResponseDTO } from '../models/etiqueta.dto';
import { EtiquetaFormValue, EtiquetaVM } from '../models/etiqueta.vm';

/** `TagResponseDTO` → VM. `organismoNombre` lo completa el facade (cruce con organismos). */
export function toEtiquetaVM(dto: TagResponseDTO): EtiquetaVM {
  return {
    id: dto.id,
    slug: dto.slug,
    organismoId: dto.organismId ?? null,
    organismoNombre: null,
    local: dto.local,
  };
}

/** Form → request. `local` no se manda: el backend lo deriva del organismo. */
export function toTagRequest(form: EtiquetaFormValue): TagRequestDTO {
  return { slug: form.slug, organismId: form.organismoId ?? null };
}

/**
 * Siembra del mock: el modelo legado `Etiqueta` (que sigue usando el mock de trámites) se proyecta
 * al contrato real. Todas quedan GLOBALES (sin organismo).
 */
export function etiquetaLegadaToVM(e: Etiqueta): EtiquetaVM {
  return toEtiquetaVM({ id: `tag-${e.id}`, slug: e.slug, local: false, organismId: null });
}
