import {
  MOCK_CATEGORIAS,
  MOCK_CONTENIDO_LOCALIDAD,
  MOCK_DESTINATARIOS,
  MOCK_ETIQUETAS,
  MOCK_EVENTOS_DE_VIDA,
  MOCK_LOCALIDADES,
  MOCK_MODALIDADES,
  MOCK_ORGANISMOS,
  MOCK_TRAMITES,
} from '@/mocks/mock-data';
import type {
  Categoria,
  Destinatario,
  Etiqueta,
  EventoDeVida,
  Localidad,
  Modalidad,
  Organismo,
  Tramite,
  TramiteContenidoLocalidad,
} from '@/models/tramite.model';

export interface PublicSearchParams {
  search?: string;
  organismoId?: string;
  modalidadId?: number;
  destinatarioId?: number;
  localidadId?: number;
  etiquetaId?: number;
}

export interface LifeEvent {
  title: string;
  description: string;
  search: string;
  accent: 'gold' | 'forest' | 'clay';
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function sanitizeText(value: string | null | undefined) {
  if (!value) {
    return value ?? null;
  }

  return value
    .replaceAll('\u00c3\u00b3', 'o')
    .replaceAll('\u00c3\u00a9', 'e')
    .replaceAll('\u00c3\u00a1', 'a')
    .replaceAll('\u00c3\u00ad', 'i')
    .replaceAll('\u00c3\u00ba', 'u')
    .replaceAll('\u00c3\u00b1', 'n')
    .replaceAll('\u00c2\u00bf', '')
    .replaceAll('\u00c3\u0098', 'U');
}

function sanitizeOrganismo(organismo: Organismo | undefined): Organismo | undefined {
  if (!organismo) {
    return undefined;
  }

  return {
    ...organismo,
    nombre: sanitizeText(organismo.nombre) ?? organismo.nombre,
  };
}

function sanitizeEtiqueta(etiqueta: Etiqueta): Etiqueta {
  return {
    ...etiqueta,
    nombre: sanitizeText(etiqueta.nombre) ?? etiqueta.nombre,
  };
}

function sanitizeTramite(tramite: Tramite): Tramite {
  return {
    ...tramite,
    titulo: sanitizeText(tramite.titulo) ?? tramite.titulo,
    resumen: sanitizeText(tramite.resumen),
    descripcionLarga: sanitizeText(tramite.descripcionLarga),
    organismo: sanitizeOrganismo(tramite.organismo),
    modalidad: tramite.modalidad,
    etiquetas: tramite.etiquetas.map(sanitizeEtiqueta),
  };
}

export function getPublishedTramites(): Tramite[] {
  return MOCK_TRAMITES.filter((tramite) => tramite.estado === 'publicado').map(sanitizeTramite);
}

export function getFeaturedTramites(limit = 3): Tramite[] {
  return getPublishedTramites()
    .filter((tramite) => tramite.destacado)
    .slice(0, limit);
}

export function searchPublicTramites(params: PublicSearchParams): Tramite[] {
  const query = params.search ? normalize(params.search) : '';

  return getPublishedTramites().filter((tramite) => {
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

export function getTramiteBySlug(slug: string): Tramite | undefined {
  return getPublishedTramites().find((tramite) => tramite.slug === slug);
}

export function getOrganismos(): Organismo[] {
  return MOCK_ORGANISMOS.map((organismo) => ({
    ...organismo,
    nombre: sanitizeText(organismo.nombre) ?? organismo.nombre,
  }));
}

export function getModalidades(): Modalidad[] {
  return MOCK_MODALIDADES.filter((m) => m.activo);
}

export function getEtiquetas(): Etiqueta[] {
  return MOCK_ETIQUETAS.filter((e) => e.activo).map(sanitizeEtiqueta);
}

export function getCategorias(): Categoria[] {
  const roots = MOCK_CATEGORIAS
    .filter((c) => c.parentId === null && c.activo)
    .sort((a, b) => a.orden - b.orden);

  return roots.map((root) => ({
    ...root,
    children: MOCK_CATEGORIAS
      .filter((c) => c.parentId === root.id && c.activo)
      .sort((a, b) => a.orden - b.orden),
  }));
}

export function getCategoriaBySlug(slug: string): Categoria | undefined {
  const all = getCategorias();
  for (const cat of all) {
    if (cat.slug === slug) return cat;
    const child = cat.children?.find((c) => c.slug === slug);
    if (child) return child;
  }
  return undefined;
}

export function getDestinatarios(): Destinatario[] {
  return MOCK_DESTINATARIOS.filter((d) => d.activo).sort((a, b) => a.orden - b.orden);
}

export function getLocalidades(): Localidad[] {
  return MOCK_LOCALIDADES.filter((l) => l.activo).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function getEventosDeVida(): EventoDeVida[] {
  return MOCK_EVENTOS_DE_VIDA.filter((e) => e.activo);
}

export function getSubcategorias(parentId: number): Categoria[] {
  return MOCK_CATEGORIAS
    .filter((c) => c.parentId === parentId && c.activo)
    .sort((a, b) => a.orden - b.orden);
}

export function getTramitesByCategoriaId(categoriaId: number): Tramite[] {
  return getPublishedTramites().filter((t) => t.categoriaId === categoriaId);
}

export function getContenidoLocalidad(
  tramiteId: string,
  localidadId: number
): TramiteContenidoLocalidad | undefined {
  return MOCK_CONTENIDO_LOCALIDAD.find(
    (c) => c.tramiteId === tramiteId && c.localidadId === localidadId && c.activo
  );
}

export function getLifeEvents(): LifeEvent[] {
  return [
    {
      title: 'Empezar a estudiar',
      description: 'Becas, boleto estudiantil y tramites para acompanar el recorrido educativo.',
      search: 'beca',
      accent: 'gold',
    },
    {
      title: 'Resolver temas de salud',
      description: 'Credenciales, certificados y gestiones frecuentes con organismos sanitarios.',
      search: 'ips',
      accent: 'forest',
    },
    {
      title: 'Ordenar documentacion',
      description: 'Turnos, residencia e identidad en un solo punto de consulta.',
      search: 'registro',
      accent: 'clay',
    },
  ];
}
