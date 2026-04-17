/**
 * Implementación API real para el dominio `tramites`.
 *
 * Los paths son provisionales — ajustarlos cuando esté definido el contrato REST
 * del backoffice. Cambiar solo en este archivo (todas las rutas centralizadas).
 */

import type { Tramite, TramiteContenidoLocalidad } from "@/models/tramite.model"
import { apiGet, apiGetOptional } from "./client"
import { tags } from "./tags"
import type { PublicSearchParams } from "@/lib/data/tramites"

export async function getPublishedTramites(): Promise<Tramite[]> {
  return apiGet<Tramite[]>("/tramites", {
    query: { estado: "publicado" },
    tags: [tags.tramites()],
  })
}

export async function getFeaturedTramites(limit = 3): Promise<Tramite[]> {
  return apiGet<Tramite[]>("/tramites", {
    query: { estado: "publicado", destacado: true, limit },
    tags: [tags.tramites()],
  })
}

export async function searchPublicTramites(params: PublicSearchParams): Promise<Tramite[]> {
  return apiGet<Tramite[]>("/tramites/search", {
    query: {
      estado: "publicado",
      q: params.search,
      organismoId: params.organismoId,
      modalidadId: params.modalidadId,
      destinatarioId: params.destinatarioId,
      localidadId: params.localidadId,
      etiquetaId: params.etiquetaId,
    },
    tags: [tags.tramites()],
  })
}

export async function getTramiteBySlug(slug: string): Promise<Tramite | undefined> {
  return apiGetOptional<Tramite>(`/tramites/${encodeURIComponent(slug)}`, {
    tags: [tags.tramite(slug)],
  })
}

export async function getTramitesByCategoriaId(categoriaId: number): Promise<Tramite[]> {
  return apiGet<Tramite[]>(`/categorias/${categoriaId}/tramites`, {
    query: { estado: "publicado" },
    tags: [tags.tramitesByCategoria(categoriaId)],
  })
}

export async function getTramitesByOrganismoId(organismoId: string): Promise<Tramite[]> {
  return apiGet<Tramite[]>(`/organismos/${encodeURIComponent(organismoId)}/tramites`, {
    query: { estado: "publicado" },
    tags: [tags.tramitesByOrganismo(organismoId)],
  })
}

export async function getTramitesByEventoId(eventoId: number): Promise<Tramite[]> {
  return apiGet<Tramite[]>(`/eventos-de-vida/${eventoId}/tramites`, {
    query: { estado: "publicado" },
    tags: [tags.tramitesByEvento(eventoId)],
  })
}

export async function getContenidoLocalidad(
  tramiteId: string,
  localidadId: number,
): Promise<TramiteContenidoLocalidad | undefined> {
  return apiGetOptional<TramiteContenidoLocalidad>(
    `/tramites/${encodeURIComponent(tramiteId)}/contenido-localidad/${localidadId}`,
    { tags: [tags.contenidoLocalidad(tramiteId, localidadId)] },
  )
}
