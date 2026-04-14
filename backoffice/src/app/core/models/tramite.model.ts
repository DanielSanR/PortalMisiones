export interface Tramite {
  id: string;
  titulo: string;
  slug: string;
  resumen: string | null;
  descripcionLarga: string | null;
  requisitos: string | null;
  costos: string | null;
  formularios: string | null;
  contacto: string | null;
  sitioWebTramite: string | null;
  urlOficial: string;
  organismoId: string;
  modalidadId: number;
  categoriaId: number | null;
  icono: string;
  estado: TramiteEstado;
  destacado: boolean;
  etiquetas: Etiqueta[];
  categorias?: Pick<Categoria, 'id' | 'nombre'>[];
  destinatarios?: Pick<Destinatario, 'id' | 'nombre'>[];
  localidades?: Pick<Localidad, 'id' | 'nombre'>[];
  eventosDeVida?: Pick<EventoDeVida, 'id' | 'nombre'>[];
  organismo?: Organismo;
  modalidad?: Modalidad;
  contenidoLocalidad?: TramiteContenidoLocalidad[];
  createdAt: string;
  updatedAt: string;
}

export type TramiteEstado = 'borrador' | 'revision' | 'publicado' | 'despublicado';

export interface TramiteCreate {
  titulo: string;
  resumen: string;
  descripcionLarga?: string;
  requisitos?: string;
  costos?: string;
  formularios?: string;
  contacto?: string;
  sitioWebTramite?: string;
  urlOficial: string;
  organismoId: string;
  modalidadId: number;
  categoriaId?: number;
  icono: string;
  etiquetaIds: number[];
  categoriaIds?: number[];
  destinatarioIds?: number[];
  localidadIds?: number[];
  eventoDeVidaIds?: number[];
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
  categoriaId?: number;
  etiquetaId?: number;
  destinatarioId?: number;
  localidadId?: number;
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
  nombre: string;
  descripcion: string | null;
  icono: string;
  color: string;
  activo: boolean;
  tramitesCount?: number;
}

export interface ModalidadCreate {
  nombre: string;
  descripcion?: string;
  icono?: string;
  color?: string;
}

export interface ModalidadUpdate extends Partial<ModalidadCreate> {
  activo?: boolean;
}

export interface Etiqueta {
  id: number;
  nombre: string;
  slug: string;
  icono: string;
  color: string;
  activo: boolean;
  tramitesCount?: number;
}

export interface EtiquetaCreate {
  nombre: string;
  icono?: string;
  color?: string;
}

export interface EtiquetaUpdate extends Partial<EtiquetaCreate> {
  activo?: boolean;
}

export interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  icono: string;
  color: string;
  parentId: number | null;
  orden: number;
  activo: boolean;
  children?: Categoria[];
  tramitesCount?: number;
}

export interface CategoriaCreate {
  nombre: string;
  descripcion?: string;
  icono?: string;
  color?: string;
  parentId?: number;
  orden?: number;
}

export interface CategoriaUpdate extends Partial<CategoriaCreate> {
  activo?: boolean;
}

export interface Destinatario {
  id: number;
  nombre: string;
  slug: string;
  icono: string;
  orden: number;
  activo: boolean;
}

export interface TramiteContenidoLocalidad {
  id: number;
  tramiteId: string;
  localidadId: number;
  localidadNombre?: string;
  costos: string | null;
  contacto: string | null;
  sitioWeb: string | null;
  urlTramite: string | null;
  horarios: string | null;
  notas: string | null;
  activo: boolean;
}

export interface TramiteContenidoLocalidadCreate {
  localidadId: number;
  costos?: string;
  contacto?: string;
  sitioWeb?: string;
  urlTramite?: string;
  horarios?: string;
  notas?: string;
}

export interface TramiteContenidoLocalidadUpdate extends Partial<TramiteContenidoLocalidadCreate> {
  activo?: boolean;
}

export interface Localidad {
  id: number;
  nombre: string;
  departamento: string;
  codigoPostal: string | null;
  activo: boolean;
  tramitesCount?: number;
}

export interface LocalidadCreate {
  nombre: string;
  departamento: string;
  codigoPostal?: string;
}

export interface LocalidadUpdate extends Partial<LocalidadCreate> {
  activo?: boolean;
}

export interface EventoDeVida {
  id: number;
  nombre: string;
  descripcion: string | null;
  icono: string;
  color: string;
  activo: boolean;
  tramitesCount?: number;
  tramites?: Pick<Tramite, 'id' | 'titulo'>[];
}

export interface EventoDeVidaCreate {
  nombre: string;
  descripcion?: string;
  icono?: string;
  color?: string;
  tramiteIds?: string[];
}

export interface EventoDeVidaUpdate extends Partial<EventoDeVidaCreate> {
  activo?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
