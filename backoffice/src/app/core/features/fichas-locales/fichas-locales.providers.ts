import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { FICHAS_LOCALES_DS } from './datasources/fichas-locales.datasource';
import { FichasLocalesHttpDataSource } from './datasources/fichas-locales.http.datasource';
import { FichasLocalesMockDataSource } from './datasources/fichas-locales.mock.datasource';

/**
 * Wiring del feature fichas por localidad: `/api/organism-procedure-location` real o mock según
 * `featureOverrides`. Va con la misma fuente que `'puntos-atencion'` (y que el resto de la cadena de
 * trámites), para no mezclar ids reales con ids mock (PLAN_TRAMITES_API.md §8).
 */
export const provideFichasLocalesFeature = (): Provider[] => [
  provideDataSource(FICHAS_LOCALES_DS, 'fichas-locales', FichasLocalesHttpDataSource, FichasLocalesMockDataSource),
];
