import { MOCK_ETIQUETAS, MOCK_MODALIDADES, MOCK_ORGANISMOS, MOCK_TRAMITES } from '@/mocks/mock-data';
import type { Etiqueta, Modalidad, Organismo, Tramite } from '@/models/tramite.model';

export interface PublicSearchParams {
  search?: string;
  organismoId?: string;
  modalidadId?: number;
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
    .replaceAll('Ã³', 'o')
    .replaceAll('Ã©', 'e')
    .replaceAll('Ã¡', 'a')
    .replaceAll('Ã­', 'i')
    .replaceAll('Ãº', 'u')
    .replaceAll('Ã±', 'n')
    .replaceAll('Â¿', '')
    .replaceAll('Ãš', 'U');
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
    categoria: sanitizeText(etiqueta.categoria) ?? etiqueta.categoria,
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
    const coincideEtiqueta =
      !params.etiquetaId || tramite.etiquetas.some((etiqueta) => etiqueta.id === params.etiquetaId);

    return hayTexto && coincideOrganismo && coincideModalidad && coincideEtiqueta;
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
  return MOCK_MODALIDADES;
}

export function getEtiquetas(): Etiqueta[] {
  return MOCK_ETIQUETAS.map(sanitizeEtiqueta);
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
