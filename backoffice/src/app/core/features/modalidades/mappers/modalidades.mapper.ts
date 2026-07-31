import { ModalityRequestDTO, ModalityResponseDTO } from '../models/modalidad.dto';
import { ModalidadFormValue, ModalidadVM } from '../models/modalidad.vm';

/** DTO backend → ViewModel. */
export function toModalidadVM(dto: ModalityResponseDTO): ModalidadVM {
  return { id: dto.id, nombre: dto.name, activo: dto.active };
}

/** Form → request de creación/edición. */
export function toModalityRequest(form: ModalidadFormValue): ModalityRequestDTO {
  return { name: form.nombre };
}
