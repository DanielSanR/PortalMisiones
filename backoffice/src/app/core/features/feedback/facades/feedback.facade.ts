import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FeedbackRepository } from '../repositories/feedback.repository';
import { FeedbackFilterVM, FeedbackPageVM, FeedbackStatsVM } from '../models/feedback.vm';

/**
 * Facade de Feedback Ciudadano (feature bloqueada por backend; corre en mock). Expone
 * Observables (async pipe; NO signals). Depende solo del repositorio. La paginación y los
 * filtros son server-side, así que no cachea: cada consulta devuelve su propia página.
 */
@Injectable({ providedIn: 'root' })
export class FeedbackFacade {
  constructor(private feedback: FeedbackRepository) {}

  list(filter: FeedbackFilterVM): Observable<FeedbackPageVM> {
    return this.feedback.list(filter);
  }

  getStats(): Observable<FeedbackStatsVM> {
    return this.feedback.getStats();
  }
}
