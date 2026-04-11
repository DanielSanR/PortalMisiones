export interface Tramite {
  id: string;
  titulo: string;
  slug: string;
  resumen: string | null;
  descripcionLarga: string | null;
  urlOficial: string;
  organismoId: string;
  modalidadId: number;
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

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: UsuarioRol;
  organismoId: string | null;
  organismo?: Organismo;
  activo: boolean;
  createdAt: string;
}

export type UsuarioRol = 'superadmin' | 'admin_organismo' | 'editor';

export interface AuditoriaTramite {
  id: number;
  tramiteId: string;
  usuarioId: string;
  accion: 'crear' | 'editar' | 'publicar' | 'despublicar';
  datosAnteriores: Record<string, unknown> | null;
  datosNuevos: Record<string, unknown> | null;
  fechaAccion: string;
  usuario?: Usuario;
}

export interface MetricaBusqueda {
  id: number;
  terminoBusqueda: string;
  resultadosEncontrados: number;
  fechaBusqueda: string;
}

export interface FeedbackTramite {
  id: number;
  tramiteId: string;
  esUtil: boolean;
  comentario: string | null;
  fechaFeedback: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  usuario: Usuario;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface DashboardMetrics {
  totalTramites: number;
  tramitesPublicados: number;
  tramitesBorrador: number;
  totalOrganismos: number;
  busquedasHoy: number;
  busquedasSinResultado: number;
  topTramitesConsultados: { tramiteId: string; titulo: string; consultas: number }[];
  topBusquedas: { termino: string; cantidad: number }[];
  satisfaccionPromedio: number;
}
