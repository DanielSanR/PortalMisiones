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
    // Rango de DÍAS inclusivo en ambos extremos: se compara el día (local) de cada opinión contra
    // `YYYY-MM-DD`. Comparar el timestamp ISO completo dejaba afuera el día final
    // ('2026-04-10T14:32:00Z' > '2026-04-10').
    const { fechaDesde, fechaHasta } = filter;
    if (fechaDesde) filtrados = filtrados.filter((f) => diaLocal(f.fechaFeedback) >= fechaDesde);
    if (fechaHasta) filtrados = filtrados.filter((f) => diaLocal(f.fechaFeedback) <= fechaHasta);

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

/** Día calendario local (`YYYY-MM-DD`) de un timestamp ISO, el mismo formato que mandan los filtros. */
function diaLocal(iso: string): string {
  const fecha = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}
