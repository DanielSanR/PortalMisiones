import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { ORGANISMOS_DS } from './datasources/organismos.datasource';
import { OrganismosHttpDataSource } from './datasources/organismos.http.datasource';
import { OrganismosMockDataSource } from './datasources/organismos.mock.datasource';

/** Wiring del feature organismos. Backend real disponible (SUPERADMIN) → 'local' (http) por defecto. */
export const provideOrganismosFeature = (): Provider[] => [
  provideDataSource(ORGANISMOS_DS, 'organismos', OrganismosHttpDataSource, OrganismosMockDataSource),
];
