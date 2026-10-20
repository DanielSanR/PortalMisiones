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

