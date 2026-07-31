import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { MODALIDADES_DS } from './datasources/modalidades.datasource';
import { ModalidadesHttpDataSource } from './datasources/modalidades.http.datasource';
import { ModalidadesMockDataSource } from './datasources/modalidades.mock.datasource';

/** Wiring del feature modalidades. Backend real disponible → 'local' (http) por defecto. */
export const provideModalidadesFeature = (): Provider[] => [
  provideDataSource(MODALIDADES_DS, 'modalidades', ModalidadesHttpDataSource, ModalidadesMockDataSource),
];
