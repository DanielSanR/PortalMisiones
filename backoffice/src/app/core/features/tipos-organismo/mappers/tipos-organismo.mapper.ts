import { OrganismTypeRequestDTO, OrganismTypeResponseDTO } from '../models/tipo-organismo.dto';
import { TipoOrganismoFormValue, TipoOrganismoVM } from '../models/tipo-organismo.vm';

/** DTO backend → ViewModel. */
export function toTipoOrganismoVM(dto: OrganismTypeResponseDTO): TipoOrganismoVM {
  return {
    id: dto.id,
    code: dto.code,
    nombre: dto.name,
    descripcion: dto.description ?? '',
    activo: dto.active,
  };
}

/** Form → request de creación/edición. */
export function toOrganismTypeRequest(form: TipoOrganismoFormValue): OrganismTypeRequestDTO {
  return {
    name: form.nombre,
    description: form.descripcion || null,
    active: form.activo,
  };
}
