import { canonicalizarSlug } from '@core/utils/slug.utils';
import { OrganismProcedureLocationRequestDTO, OrganismProcedureLocationResponseDTO } from '../models/ficha-local.dto';
import { FichaLocal, FichaLocalFormValue } from '../models/ficha-local.vm';

/** Texto opcional: vacío o solo espacios → `null`. */
function textoONull(valor: string | null | undefined): string | null {
  const limpio = (valor ?? '').trim();
  return limpio ? limpio : null;
}

/**
 * Response → ficha. Los textos opcionales (`url`, `requirements`, `costs`) pueden venir en `null`.
 *
 * COMPATIBILIDAD TEMPORAL: si faltan la adopción o la localidad (backend anterior a `586b670`, response de 5
 * campos), la ficha sale marcada `sinContenido` y con esos ids vacíos; nadie arma un PUT sobre ella.
 */
export function toFichaLocal(dto: OrganismProcedureLocationResponseDTO): FichaLocal {
  const ficha: FichaLocal = {
    id: dto.id,
    slug: dto.slug,
    estado: dto.publicationStatus,
    activa: dto.active,
    version: dto.currentVersionNumber ?? 0,
    adopcionId: dto.organismProcedureId ?? '',
    localidadId: dto.locationId ?? '',
    url: dto.url ?? null,
    requisitos: dto.requirements ?? null,
    costos: dto.costs ?? null,
  };
  return ficha.adopcionId && ficha.localidadId ? ficha : { ...ficha, sinContenido: true };
}

/**
 * Form → request. No lleva `publicationStatus`: el backend lo ignora en POST y PUT. El slug se
 * canonicaliza (el backend no lo hace con el de la ficha), salvo con `conservarSlug` (edición sin tocarlo):
 * ahí viaja tal cual se leyó, para no cambiarle la dirección pública a una ficha con un slug heredado no
 * canónico. Textos opcionales vacíos → `null`.
 */
export function toOrganismProcedureLocationRequest(form: FichaLocalFormValue): OrganismProcedureLocationRequestDTO {
  return {
    organismProcedureId: form.adopcionId,
    locationId: form.localidadId,
    slug: form.conservarSlug ? form.slug : canonicalizarSlug(form.slug),
    url: textoONull(form.url),
    requirements: textoONull(form.requisitos),
    costs: textoONull(form.costos),
    active: form.activa,
  };
}
