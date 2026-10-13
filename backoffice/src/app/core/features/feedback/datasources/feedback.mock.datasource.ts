import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { FeedbackDataSource } from './feedback.datasource';
import { MOCK_FEEDBACK_ITEMS } from './feedback.mock-data';
import { toFeedbackPageVM, toFeedbackStatsVM } from '../mappers/feedback.mapper';
import { FeedbackDTO, FeedbackStatsDTO } from '../models/feedback.dto';
import { FeedbackFilterVM, FeedbackPageVM, FeedbackStatsVM } from '../models/feedback.vm';

const DELAY = 200;

/**
 * Implementación mock en memoria. Replica lo que hacía la ruta `/api/feedback` del interceptor:
 * filtra por búsqueda (trámite u organismo), valoración, trámite y rango de fechas, ordena por
 * fecha desc y pagina (1-based). Las estadísticas son globales (no dependen del filtro) y se
 * derivan del total de opiniones.
 */
@Injectable()
export class FeedbackMockDataSource extends FeedbackDataSource {
  private readonly data: FeedbackDTO[] = [...MOCK_FEEDBACK_ITEMS];

  list(filter: FeedbackFilterVM): Observable<FeedbackPageVM> {
    let filtrados = [...this.data];

    if (filter.search) {
      const q = filter.search.toLowerCase();
      filtrados = filtrados.filter(
        (f) => f.tramiteTitulo?.toLowerCase().includes(q) || f.organismoNombre?.toLowerCase().includes(q),
      );
    }
    if (filter.esUtil !== undefined && filter.esUtil !== null) {
      filtrados = filtrados.filter((f) => f.esUtil === filter.esUtil);
    }
    if (filter.tramiteId) filtrados = filtrados.filter((f) => f.tramiteId === filter.tramiteId);
    // Comparación de strings ISO contra `YYYY-MM-DD`, igual que el mock anterior.
    const { fechaDesde, fechaHasta } = filter;
    if (fechaDesde) filtrados = filtrados.filter((f) => f.fechaFeedback >= fechaDesde);
    if (fechaHasta) filtrados = filtrados.filter((f) => f.fechaFeedback <= fechaHasta);

    filtrados.sort((a, b) => b.fechaFeedback.localeCompare(a.fechaFeedback));

    const page = filter.page || 1;
    const pageSize = filter.pageSize || 10;
    const data = filtrados.slice((page - 1) * pageSize, page * pageSize);
    return of(toFeedbackPageVM({ data, total: filtrados.length })).pipe(delay(DELAY));
  }

  getStats(): Observable<FeedbackStatsVM> {
    const total = this.data.length;
    const totalUtil = this.data.filter((f) => f.esUtil).length;
    const stats: FeedbackStatsDTO = {
      total,
      totalUtil,
      totalNoUtil: total - totalUtil,
      totalConComentario: this.data.filter((f) => !!f.comentario).length,
      porcentajeUtil: total > 0 ? Math.round((totalUtil / total) * 100) : 0,
    };
    return of(toFeedbackStatsVM(stats)).pipe(delay(DELAY));
  }
}
