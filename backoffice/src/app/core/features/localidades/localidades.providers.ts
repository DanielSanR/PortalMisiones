import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { LOCALIDADES_DS } from './datasources/localidades.datasource';
import { LocalidadesHttpDataSource } from './datasources/localidades.http.datasource';
import { LocalidadesMockDataSource } from './datasources/localidades.mock.datasource';

/** Wiring del feature localidades. Backend real disponible (público) → 'local' (http) por defecto. */
export const provideLocalidadesFeature = (): Provider[] => [
  provideDataSource(LOCALIDADES_DS, 'localidades', LocalidadesHttpDataSource, LocalidadesMockDataSource),
];
