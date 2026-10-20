import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { DashboardDataSource } from './dashboard.datasource';
import { MOCK_DASHBOARD_HOME } from './dashboard.mock-data';
import { toDashboardHomeVM } from '../mappers/dashboard.mapper';
import { DashboardHomeVM } from '../models/dashboard.vm';

const DELAY = 200;

/** Implementación mock: sirve los datos de ejemplo del Home mapeados a VM, con latencia corta. */
@Injectable()
export class DashboardMockDataSource extends DashboardDataSource {
  getHome(): Observable<DashboardHomeVM> {
    return of(toDashboardHomeVM(MOCK_DASHBOARD_HOME)).pipe(delay(DELAY));
  }
}
