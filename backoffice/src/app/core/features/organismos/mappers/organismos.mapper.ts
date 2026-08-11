import { OrganismRequestDTO, OrganismResponseDTO } from '../models/organismo.dto';
import { OrganismoFormValue, OrganismoVM } from '../models/organismo.vm';

/** DTO backend → ViewModel (sin `tipoNombre`; lo resuelve el facade). */
export function toOrganismoVM(dto: OrganismResponseDTO): OrganismoVM {
  return {
    id: dto.id,
    typeId: dto.typeId,
    parentId: dto.parentId ?? null,
    baseLocationId: dto.baseLocationId ?? null,
    nombre: dto.name,
    acronym: dto.acronym ?? '',
    activo: dto.active,
    createdAt: dto.createdAt ?? null,
    updatedAt: dto.updatedAt ?? null,
  };
}

/** Form → request de creación/edición. */
export function toOrganismRequest(form: OrganismoFormValue): OrganismRequestDTO {
  return {
    typeId: form.typeId,
    parentId: form.parentId || null,
    baseLocationId: form.baseLocationId || null,
    name: form.nombre,
    acronym: form.acronym || null,
    active: form.activo,
  };
}
