import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { ORGANISMOS_DS } from './datasources/organismos.datasource';
import { OrganismosMockDataSource } from './datasources/organismos.mock.datasource';

/**
 * Wiring del feature organismos. Sin backend real aún → mock como impl única
 * (se pasa también como httpImpl porque nunca se instancia con dataSource≠mock).
 */
export const provideOrganismosFeature = (): Provider[] => [
  provideDataSource(ORGANISMOS_DS, 'organismos', OrganismosMockDataSource, OrganismosMockDataSource),
];
