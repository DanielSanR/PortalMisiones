import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardHomeVM } from '../models/dashboard.vm';

/**
 * Fuente de datos del Home. BLOQUEADA por backend: hoy solo existe la impl mock.
 * Cuando el backend exponga métricas/analítica, se agrega `*.http.datasource.ts` y se quita el override.
 */
export abstract class DashboardDataSource {
  abstract getHome(): Observable<DashboardHomeVM>;
}

export const DASHBOARD_DS = new InjectionToken<DashboardDataSource>('DASHBOARD_DS');
