import { RecipientRequestDTO, RecipientResponseDTO } from '../models/destinatario.dto';
import { DestinatarioFormValue, DestinatarioVM } from '../models/destinatario.vm';

/** DTO backend → ViewModel. */
export function toDestinatarioVM(dto: RecipientResponseDTO): DestinatarioVM {
  return { id: dto.id, nombre: dto.name };
}

/** Form → request de creación/edición. */
export function toRecipientRequest(form: DestinatarioFormValue): RecipientRequestDTO {
  return { name: form.nombre };
}
