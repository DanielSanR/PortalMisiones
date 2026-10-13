import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { FeedbackFilterVM, FeedbackPageVM, FeedbackStatsVM } from '../models/feedback.vm';

/**
 * Fuente de datos de Feedback Ciudadano. BLOQUEADA por backend: hoy solo existe la impl mock.
 * Cuando el backend exponga el endpoint, se agrega `*.http.datasource.ts` y se cambia el override.
 */
export abstract class FeedbackDataSource {
  abstract list(filter: FeedbackFilterVM): Observable<FeedbackPageVM>;
  abstract getStats(): Observable<FeedbackStatsVM>;
}

export const FEEDBACK_DS = new InjectionToken<FeedbackDataSource>('FEEDBACK_DS');
