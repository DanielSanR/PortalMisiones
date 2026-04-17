import {
  MOCK_DESTINATARIOS,
  MOCK_ETIQUETAS,
  MOCK_EVENTOS_DE_VIDA,
  MOCK_LOCALIDADES,
  MOCK_MODALIDADES,
  MOCK_ORGANISMOS,
} from '@/mocks/mock-data';
import { sanitizeEtiqueta, sanitizeText } from '@/lib/format/sanitize';
import { slugify } from '@/lib/format/slugify';
import type {
  Destinatario,
  Etiqueta,
  EventoDeVida,
  Localidad,
  Modalidad,
  Organismo,
} from '@/models/tramite.model';

/** Slug URL-safe derivado de sigla (cuando existe) o nombre. */
export function organismoSlug(organismo: Pick<Organismo, 'sigla' | 'nombre'>): string {
  return organismo.sigla ? slugify(organismo.sigla) : slugify(organismo.nombre);
}

/** Slug URL-safe derivado del nombre. */
export function eventoSlug(evento: Pick<EventoDeVida, 'nombre'>): string {
  return slugify(evento.nombre);
}

export async function getOrganismos(): Promise<Organismo[]> {
  return MOCK_ORGANISMOS.map((organismo) => ({
    ...organismo,
    nombre: sanitizeText(organismo.nombre) ?? organismo.nombre,
  }));
}

export async function getModalidades(): Promise<Modalidad[]> {
  return MOCK_MODALIDADES.filter((m) => m.activo);
}

export async function getEtiquetas(): Promise<Etiqueta[]> {
  return MOCK_ETIQUETAS.filter((e) => e.activo).map(sanitizeEtiqueta);
}

export async function getDestinatarios(): Promise<Destinatario[]> {
  return MOCK_DESTINATARIOS.filter((d) => d.activo).sort((a, b) => a.orden - b.orden);
}

export async function getLocalidades(): Promise<Localidad[]> {
  return MOCK_LOCALIDADES.filter((l) => l.activo).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function getEventosDeVida(): Promise<EventoDeVida[]> {
  return MOCK_EVENTOS_DE_VIDA.filter((e) => e.activo);
}

export async function getOrganismoBySlug(slug: string): Promise<Organismo | undefined> {
  const organismos = await getOrganismos();
  return organismos.find((o) => organismoSlug(o) === slug);
}

export async function getEventoDeVidaBySlug(slug: string): Promise<EventoDeVida | undefined> {
  const all = MOCK_EVENTOS_DE_VIDA.map((e) => ({
    ...e,
    nombre: sanitizeText(e.nombre) ?? e.nombre,
    descripcion: sanitizeText(e.descripcion),
  }));
  return all.find((e) => eventoSlug(e) === slug);
}

export interface LifeEvent {
  title: string;
  description: string;
  search: string;
  accent: 'gold' | 'forest' | 'clay';
}

export async function getLifeEvents(): Promise<LifeEvent[]> {
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
