import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { MUNICIPIOS_DS } from './datasources/municipios.datasource';
import { MunicipiosHttpDataSource } from './datasources/municipios.http.datasource';
import { MunicipiosMockDataSource } from './datasources/municipios.mock.datasource';

/** Wiring del feature municipios. Backend real disponible → 'local' (http) por defecto. */
export const provideMunicipiosFeature = (): Provider[] => [
  provideDataSource(MUNICIPIOS_DS, 'municipios', MunicipiosHttpDataSource, MunicipiosMockDataSource),
];
