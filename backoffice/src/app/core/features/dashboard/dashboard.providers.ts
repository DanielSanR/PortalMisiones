import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { DASHBOARD_DS } from './datasources/dashboard.datasource';
import { DashboardMockDataSource } from './datasources/dashboard.mock.datasource';

/**
 * Wiring del feature dashboard. Bloqueado por backend → solo mock (se pasa como ambas impls
 * porque `featureOverrides.dashboard = 'mock'`). Al haber endpoint real: agregar HttpDataSource
 * como primer argumento y quitar el override.
 */
export const provideDashboardFeature = (): Provider[] => [
  provideDataSource(DASHBOARD_DS, 'dashboard', DashboardMockDataSource, DashboardMockDataSource),
];
