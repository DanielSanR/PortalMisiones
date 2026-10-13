import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DASHBOARD_DS, DashboardDataSource } from '../datasources/dashboard.datasource';
import { DashboardHomeVM } from '../models/dashboard.vm';

/** Repositorio del Home. Inyecta el DataSource vía token. */
@Injectable({ providedIn: 'root' })
export class DashboardRepository {
  constructor(@Inject(DASHBOARD_DS) private ds: DashboardDataSource) {}

  getHome(): Observable<DashboardHomeVM> {
    return this.ds.getHome();
  }
}
