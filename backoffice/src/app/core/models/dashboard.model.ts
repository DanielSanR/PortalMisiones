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
