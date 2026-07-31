import { LifeEventRequestDTO, LifeEventResponseDTO } from '../models/evento-de-vida.dto';
import { EventoDeVidaFormValue, EventoDeVidaVM } from '../models/evento-de-vida.vm';

/** DTO backend → ViewModel. */
export function toEventoDeVidaVM(dto: LifeEventResponseDTO): EventoDeVidaVM {
  return { id: dto.id, slug: dto.slug, nombre: dto.name };
}

/** Form → request de creación/edición. El backend genera el `slug` desde el `name`. */
export function toLifeEventRequest(form: EventoDeVidaFormValue): LifeEventRequestDTO {
  return { name: form.nombre };
}
