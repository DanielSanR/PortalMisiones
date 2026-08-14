import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { TRAMITES_DS } from './datasources/tramites.datasource';
import { TramitesMockDataSource } from './datasources/tramites.mock.datasource';

/**
 * Wiring del feature trámites. Bloqueado por backend (API spec §7) → solo mock (se pasa
 * como ambas impls porque `featureOverrides.tramites = 'mock'`). Al haber endpoint real:
 * agregar el HttpDataSource como primer argumento y quitar el override.
 */
export const provideTramitesFeature = (): Provider[] => [
  provideDataSource(TRAMITES_DS, 'tramites', TramitesMockDataSource, TramitesMockDataSource),
];
