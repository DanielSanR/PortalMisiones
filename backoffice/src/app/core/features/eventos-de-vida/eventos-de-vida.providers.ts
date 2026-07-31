import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { EVENTOS_DE_VIDA_DS } from './datasources/eventos-de-vida.datasource';
import { EventosDeVidaHttpDataSource } from './datasources/eventos-de-vida.http.datasource';
import { EventosDeVidaMockDataSource } from './datasources/eventos-de-vida.mock.datasource';

/** Wiring del feature eventos-de-vida. Backend real disponible → 'local' (http) por defecto. */
export const provideEventosDeVidaFeature = (): Provider[] => [
  provideDataSource(EVENTOS_DE_VIDA_DS, 'eventos-de-vida', EventosDeVidaHttpDataSource, EventosDeVidaMockDataSource),
];
