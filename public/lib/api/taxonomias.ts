import type {
  Destinatario,
  Etiqueta,
  EventoDeVida,
  Localidad,
  Modalidad,
  Organismo,
} from "@/models/tramite.model"
import { apiGet, apiGetOptional } from "./client"
import { tags } from "./tags"

export async function getOrganismos(): Promise<Organismo[]> {
  return apiGet<Organismo[]>("/organismos", { tags: [tags.organismos()] })
}

export async function getModalidades(): Promise<Modalidad[]> {
  return apiGet<Modalidad[]>("/modalidades", {
    query: { activo: true },
    tags: [tags.modalidades()],
  })
}

export async function getEtiquetas(): Promise<Etiqueta[]> {
  return apiGet<Etiqueta[]>("/etiquetas", {
    query: { activo: true },
    tags: [tags.etiquetas()],
  })
}

export async function getDestinatarios(): Promise<Destinatario[]> {
  return apiGet<Destinatario[]>("/destinatarios", {
    query: { activo: true },
    tags: [tags.destinatarios()],
  })
}

export async function getLocalidades(): Promise<Localidad[]> {
  return apiGet<Localidad[]>("/localidades", {
    query: { activo: true },
    tags: [tags.localidades()],
  })
}

export async function getEventosDeVida(): Promise<EventoDeVida[]> {
  return apiGet<EventoDeVida[]>("/eventos-de-vida", {
    query: { activo: true },
    tags: [tags.eventosDeVida()],
  })
}

export async function getOrganismoBySlug(slug: string): Promise<Organismo | undefined> {
  return apiGetOptional<Organismo>(`/organismos/${encodeURIComponent(slug)}`, {
    tags: [tags.organismo(slug)],
  })
}

export async function getEventoDeVidaBySlug(slug: string): Promise<EventoDeVida | undefined> {
  return apiGetOptional<EventoDeVida>(`/eventos-de-vida/${encodeURIComponent(slug)}`, {
    tags: [tags.eventoDeVida(slug)],
  })
}
