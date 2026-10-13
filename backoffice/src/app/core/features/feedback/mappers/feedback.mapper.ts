import { FeedbackDTO, FeedbackPaginaDTO, FeedbackStatsDTO } from '../models/feedback.dto';
import { FeedbackPageVM, FeedbackStatsVM, FeedbackVM } from '../models/feedback.vm';

/**
 * Mapea los DTO de feedback al VM. Cuando el backend exponga el endpoint, se ajusta el DTO y
 * este mapper sin tocar facade/componentes.
 */
export function toFeedbackVM(f: FeedbackDTO): FeedbackVM {
  return {
    id: f.id,
    tramiteId: f.tramiteId,
    tramiteTitulo: f.tramiteTitulo ?? '',
    organismoNombre: f.organismoNombre ?? '',
    esUtil: f.esUtil,
    comentario: f.comentario,
    fechaFeedback: f.fechaFeedback,
  };
}

export function toFeedbackPageVM(res: FeedbackPaginaDTO): FeedbackPageVM {
  return { items: res.data.map(toFeedbackVM), total: res.total };
}

export function toFeedbackStatsVM(s: FeedbackStatsDTO): FeedbackStatsVM {
  return {
    total: s.total,
    totalUtil: s.totalUtil,
    totalNoUtil: s.totalNoUtil,
    totalConComentario: s.totalConComentario,
    porcentajeUtil: s.porcentajeUtil,
  };
}
