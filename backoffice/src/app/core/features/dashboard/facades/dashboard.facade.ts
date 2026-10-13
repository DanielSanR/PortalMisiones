import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { DashboardHomeVM } from '../models/dashboard.vm';

/**
 * Facade del Home (feature bloqueada por backend; corre en mock). Expone Observables
 * (async pipe; NO signals). Depende solo del repositorio.
 */
@Injectable({ providedIn: 'root' })
export class DashboardFacade {
  constructor(private dashboard: DashboardRepository) {}

  /** Datos de todos los widgets del Home en una sola carga. */
  loadHome(): Observable<DashboardHomeVM> {
    return this.dashboard.getHome();
  }
}
