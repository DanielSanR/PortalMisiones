import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { PUNTOS_ATENCION_DS } from './datasources/puntos-atencion.datasource';
import { PuntosAtencionHttpDataSource } from './datasources/puntos-atencion.http.datasource';
import { PuntosAtencionMockDataSource } from './datasources/puntos-atencion.mock.datasource';

/**
 * Wiring del feature puntos de atención: `/api/attention-point` real o mock según `featureOverrides`.
 * Va con la misma fuente que `'fichas-locales'`, para no mezclar ids de fichas reales con ids mock.
 */
export const providePuntosAtencionFeature = (): Provider[] => [
  provideDataSource(PUNTOS_ATENCION_DS, 'puntos-atencion', PuntosAtencionHttpDataSource, PuntosAtencionMockDataSource),
];
