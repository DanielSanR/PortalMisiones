export interface DashboardMetrics {
  totalTramites: number;
  tramitesPublicados: number;
  tramitesBorrador: number;
  tramitesRevision: number;
  totalOrganismos: number;
  busquedasHoy: number;
  busquedasSinResultado: number;
  satisfaccionPromedio: number;
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

export interface AuditoriaTramite {
  id: number;
  tramiteId: string;
  usuarioId: string;
  accion: 'crear' | 'editar' | 'publicar' | 'despublicar';
  datosAnteriores: Record<string, unknown> | null;
  datosNuevos: Record<string, unknown> | null;
  fechaAccion: string;
  usuarioNombre?: string;
  tramiteTitulo?: string;
}

export interface FeedbackTramite {
  id: number;
  tramiteId: string;
  esUtil: boolean;
  comentario: string | null;
  fechaFeedback: string;
}
