export interface DashboardMetrics {
  totalTramites: number;
  tramitesPublicados: number;
  tramitesBorrador: number;
  tramitesRevision: number;
  tramitesDespublicados: number;
  totalOrganismos: number;
  busquedasHoy: number;
  busquedasSinResultado: number;
  satisfaccionPromedio: number;
}

export interface TramitesPorOrganismo {
  organismo: string;
  sigla: string;
  total: number;
}

export interface TopTramite {
  tramiteId: string;
  titulo: string;
  consultas: number;
}

export interface TopBusqueda {
  termino: string;
  cantidad: number;
  sinResultados: boolean;
}

export type AuditoriaAccion = 'crear' | 'editar' | 'publicar' | 'despublicar' | 'enviar_revision' | 'eliminar';

export interface AuditoriaTramite {
  id: number;
  tramiteId: string;
  usuarioId: string;
  accion: AuditoriaAccion;
  datosAnteriores: Record<string, unknown> | null;
  datosNuevos: Record<string, unknown> | null;
  fechaAccion: string;
  usuarioNombre?: string;
  tramiteTitulo?: string;
}

export interface AuditoriaFilter {
  search?: string;
  accion?: AuditoriaAccion;
  usuarioId?: string;
  tramiteId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  pageSize?: number;
}

export interface FeedbackTramite {
  id: number;
  tramiteId: string;
  tramiteTitulo?: string;
  organismoNombre?: string;
  esUtil: boolean;
  comentario: string | null;
  fechaFeedback: string;
}

export interface FeedbackFilter {
  search?: string;
  esUtil?: boolean;
  tramiteId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  pageSize?: number;
}

export interface FeedbackStats {
  total: number;
  totalUtil: number;
  totalNoUtil: number;
  totalConComentario: number;
  porcentajeUtil: number;
}
