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

export interface Organismo {
  id: string;
  nombre: string;
  sigla: string | null;
  logoUrl: string | null;
  sitioWeb: string | null;
  parentId: string | null;
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

export interface Etiqueta {
  id: number;
  nombre: string;
  slug: string;
  icono: string;
  color: string;
  activo: boolean;
  tramitesCount?: number;
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

export interface Destinatario {
  id: number;
  nombre: string;
  slug: string;
  icono: string;
  orden: number;
  activo: boolean;
}

export interface Localidad {
  id: number;
  nombre: string;
  departamento: string;
  codigoPostal: string | null;
  activo: boolean;
  tramitesCount?: number;
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
  direccion: string | null;
  telefono: string | null;
  latitud: number | null;
  longitud: number | null;
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

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
