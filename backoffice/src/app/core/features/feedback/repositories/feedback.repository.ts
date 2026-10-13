import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FEEDBACK_DS, FeedbackDataSource } from '../datasources/feedback.datasource';
import { FeedbackFilterVM, FeedbackPageVM, FeedbackStatsVM } from '../models/feedback.vm';

/** Repositorio de Feedback Ciudadano. Inyecta el DataSource vía token. */
@Injectable({ providedIn: 'root' })
export class FeedbackRepository {
  constructor(@Inject(FEEDBACK_DS) private ds: FeedbackDataSource) {}

  list(filter: FeedbackFilterVM): Observable<FeedbackPageVM> {
    return this.ds.list(filter);
  }

  getStats(): Observable<FeedbackStatsVM> {
    return this.ds.getStats();
  }
}
