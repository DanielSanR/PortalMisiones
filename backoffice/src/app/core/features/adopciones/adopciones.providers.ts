import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { ADOPCIONES_DS } from './datasources/adopciones.datasource';
import { AdopcionesHttpDataSource } from './datasources/adopciones.http.datasource';
import { AdopcionesMockDataSource } from './datasources/adopciones.mock.datasource';

/** Wiring del feature adopciones: `/api/organism-procedure` real o mock según `featureOverrides`. */
export const provideAdopcionesFeature = (): Provider[] => [
  provideDataSource(ADOPCIONES_DS, 'adopciones', AdopcionesHttpDataSource, AdopcionesMockDataSource),
];
