/**
 * Forma "cruda" del feedback ciudadano tal como lo entregaría una fuente (hoy: el mock en
 * memoria del feature). Cuando exista el endpoint real, este contrato se ajusta al DTO del
 * backend y el mapper absorbe la diferencia sin tocar facade/componentes.
 */
export interface FeedbackDTO {
  id: number;
  tramiteId: string;
  tramiteTitulo?: string;
  organismoNombre?: string;
  esUtil: boolean;
  comentario: string | null;
  /** ISO 8601. */
  fechaFeedback: string;
}

/** Una página de feedback + el total tras filtrar. */
export interface FeedbackPaginaDTO {
  data: FeedbackDTO[];
  total: number;
}

/** Indicadores agregados del feedback. */
export interface FeedbackStatsDTO {
  total: number;
  totalUtil: number;
  totalNoUtil: number;
  totalConComentario: number;
  porcentajeUtil: number;
}
