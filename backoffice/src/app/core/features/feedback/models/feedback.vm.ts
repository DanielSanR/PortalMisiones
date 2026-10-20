/**
 * ViewModels de Feedback Ciudadano. Feature BLOQUEADA por backend (corre en mock).
 * Los nombres de campo se mantienen alineados al mock actual para no alterar la pantalla.
 */
export interface FeedbackVM {
  id: number;
  tramiteId: string;
  tramiteTitulo: string;
  organismoNombre: string;
  esUtil: boolean;
  comentario: string | null;
  /** ISO 8601. */
  fechaFeedback: string;
}

/** Filtro de la consulta paginada (paginación 1-based, fechas `YYYY-MM-DD`). */
export interface FeedbackFilterVM {
  search?: string;
  esUtil?: boolean;
  tramiteId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  pageSize?: number;
}

/** Una página de resultados + el total filtrado (alimenta al paginador). */
export interface FeedbackPageVM {
  items: FeedbackVM[];
  total: number;
}

/** Indicadores agregados del feedback. */
export interface FeedbackStatsVM {
  total: number;
  totalUtil: number;
  totalNoUtil: number;
  totalConComentario: number;
  porcentajeUtil: number;
}
