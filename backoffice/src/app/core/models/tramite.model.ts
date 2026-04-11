export interface Tramite {
  id: string;
  titulo: string;
  slug: string;
  resumen: string | null;
  descripcionLarga: string | null;
  urlOficial: string;
  organismoId: string;
  modalidadId: number;
  icono: string;
  estado: TramiteEstado;
  destacado: boolean;
  etiquetas: Etiqueta[];
  organismo?: Organismo;
  modalidad?: Modalidad;
  createdAt: string;
  updatedAt: string;
}

export type TramiteEstado = 'borrador' | 'revision' | 'publicado' | 'despublicado';

export interface TramiteCreate {
  titulo: string;
  resumen: string;
  descripcionLarga?: string;
  urlOficial: string;
  organismoId: string;
  modalidadId: number;
  icono: string;
  etiquetaIds: number[];
  destacado?: boolean;
}

export interface TramiteUpdate extends Partial<TramiteCreate> {
  estado?: TramiteEstado;
}

export interface TramiteFilter {
  search?: string;
  organismoId?: string;
  modalidadId?: number;
  estado?: TramiteEstado;
  etiquetaId?: number;
  destacado?: boolean;
  page?: number;
  pageSize?: number;
}

export interface Organismo {
  id: string;
  nombre: string;
  sigla: string | null;
  logoUrl: string | null;
  sitioWeb: string | null;
  parentId: string | null;
  parent?: Organismo;
  children?: Organismo[];
}

export interface OrganismoCreate {
  nombre: string;
  sigla?: string;
  logoUrl?: string;
  sitioWeb?: string;
  parentId?: string;
}

export interface Modalidad {
  id: number;
  nombre: 'Digital' | 'Presencial' | 'Mixto';
}

export interface Etiqueta {
  id: number;
  nombre: string;
  categoria: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
