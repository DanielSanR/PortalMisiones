import { canonicalizarSlug } from '@core/utils/slug.utils';
import {
  OrganismProcedureLocationExtendedResponseDTO, OrganismProcedureLocationRequestDTO, PublicationStatus,
} from '../models/ficha-local.dto';
import { FichaLocal, FichaLocalFormValue } from '../models/ficha-local.vm';

/** Texto opcional: vacío o solo espacios → `null`. */
function textoONull(valor: string | null | undefined): string | null {
  const limpio = (valor ?? '').trim();
  return limpio ? limpio : null;
}

/**
 * Response (mínimo de hoy o extendido de G-1) → ficha. Lo que el response no trae queda en `null`;
 * `contenidoCompleto` dice si llegaron adopción y localidad (sin eso no se puede editar).
 */
export function toFichaLocal(dto: OrganismProcedureLocationExtendedResponseDTO): FichaLocal {
  const adopcionId = dto.organismProcedureId ?? null;
  const localidadId = dto.locationId ?? null;
  return {
    id: dto.id,
    slug: dto.slug,
    estado: dto.publicationStatus,
    activa: dto.active,
    version: dto.currentVersionNumber ?? 0,
    adopcionId,
    localidadId,
    url: dto.url ?? null,
    requisitos: dto.requirements ?? null,
    costos: dto.costs ?? null,
    contenidoCompleto: !!adopcionId && !!localidadId,
    plantillaId: dto.procedureTemplateId ?? null,
    plantillaTitulo: textoONull(dto.procedureTitle),
    organismoId: dto.organismId ?? null,
    organismoNombre: textoONull(dto.organismName),
    localidadNombre: textoONull(dto.locationName),
  };
}

/**
 * Form → request. `estadoActual` es el estado que la ficha TIENE (en alta, `BORRADOR`, que el backend
 * igual ignora): el PUT es reemplazo total incluido `publicationStatus` (R-1), así que reenviar el
 * actual es lo que evita que una edición cambie el estado. El slug se canonicaliza (el backend no lo
 * hace, igual que con `slugBase`, G-10). Textos opcionales vacíos → `null`.
 */
export function toOrganismProcedureLocationRequest(
  form: FichaLocalFormValue,
  estadoActual: PublicationStatus,
): OrganismProcedureLocationRequestDTO {
  return {
    organismProcedureId: form.adopcionId,
    locationId: form.localidadId,
    slug: canonicalizarSlug(form.slug),
    url: textoONull(form.url),
    requirements: textoONull(form.requisitos),
    costs: textoONull(form.costos),
    publicationStatus: estadoActual,
    active: form.activa,
  };
}
