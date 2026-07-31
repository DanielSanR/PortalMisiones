import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { TIPOS_ORGANISMO_DS } from './datasources/tipos-organismo.datasource';
import { TiposOrganismoHttpDataSource } from './datasources/tipos-organismo.http.datasource';
import { TiposOrganismoMockDataSource } from './datasources/tipos-organismo.mock.datasource';

/** Wiring del feature tipos-organismo. Backend real disponible → 'local' (http) por defecto. */
export const provideTiposOrganismoFeature = (): Provider[] => [
  provideDataSource(TIPOS_ORGANISMO_DS, 'tipos-organismo', TiposOrganismoHttpDataSource, TiposOrganismoMockDataSource),
];
