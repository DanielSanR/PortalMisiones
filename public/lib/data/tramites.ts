import { MOCK_CONTENIDO_LOCALIDAD, MOCK_EVENTOS_DE_VIDA, MOCK_TRAMITES } from '@/mocks/mock-data';
import { normalize } from '@/lib/format/normalize';
import { sanitizeTramite } from '@/lib/format/sanitize';
import type { Tramite, TramiteContenidoLocalidad } from '@/models/tramite.model';

export interface PublicSearchParams {
  search?: string;
  organismoId?: string;
  modalidadId?: number;
  destinatarioId?: number;
  localidadId?: number;
  etiquetaId?: number;
}

export async function getPublishedTramites(): Promise<Tramite[]> {
  return MOCK_TRAMITES
    .filter((tramite) => tramite.estado === 'publicado')
    .map(sanitizeTramite);
}

export async function getFeaturedTramites(limit = 3): Promise<Tramite[]> {
  const tramites = await getPublishedTramites();
  return tramites.filter((tramite) => tramite.destacado).slice(0, limit);
}

export async function searchPublicTramites(params: PublicSearchParams): Promise<Tramite[]> {
  const query = params.search ? normalize(params.search) : '';
  const tramites = await getPublishedTramites();

  return tramites.filter((tramite) => {
    const hayTexto =
      !query ||
      normalize(
        [
          tramite.titulo,
          tramite.resumen ?? '',
          tramite.descripcionLarga ?? '',
          tramite.organismo?.nombre ?? '',
          ...tramite.etiquetas.map((etiqueta) => etiqueta.nombre),
        ].join(' ')
      ).includes(query);

    const coincideOrganismo = !params.organismoId || tramite.organismoId === params.organismoId;
    const coincideModalidad = !params.modalidadId || tramite.modalidadId === params.modalidadId;
    const coincideDestinatario =
      !params.destinatarioId ||
      (tramite.destinatarios ?? []).some((d) => d.id === params.destinatarioId);
    const coincideLocalidad =
      !params.localidadId ||
      (tramite.localidades ?? []).some((l) => l.id === params.localidadId);
    const coincideEtiqueta =
      !params.etiquetaId ||
      tramite.etiquetas.some((e) => e.id === params.etiquetaId);

    return hayTexto && coincideOrganismo && coincideModalidad && coincideDestinatario && coincideLocalidad && coincideEtiqueta;
  });
}

export async function getTramiteBySlug(slug: string): Promise<Tramite | undefined> {
  const tramites = await getPublishedTramites();
  return tramites.find((tramite) => tramite.slug === slug);
}

export async function getTramitesByCategoriaId(categoriaId: number): Promise<Tramite[]> {
  const tramites = await getPublishedTramites();
  return tramites.filter((t) => t.categoriaId === categoriaId);
}

export async function getTramitesByOrganismoId(organismoId: string): Promise<Tramite[]> {
  const tramites = await getPublishedTramites();
  return tramites.filter((t) => t.organismoId === organismoId);
}

export async function getTramitesByEventoId(eventoId: number): Promise<Tramite[]> {
  const evento = MOCK_EVENTOS_DE_VIDA.find((e) => e.id === eventoId);
  if (!evento) return [];
  const ids = new Set((evento.tramites ?? []).map((t) => t.id));
  const tramites = await getPublishedTramites();
  return tramites.filter((t) => ids.has(t.id));
}

export async function getContenidoLocalidad(
  tramiteId: string,
  localidadId: number,
): Promise<TramiteContenidoLocalidad | undefined> {
  return MOCK_CONTENIDO_LOCALIDAD.find(
    (c) => c.tramiteId === tramiteId && c.localidadId === localidadId && c.activo,
  );
}
