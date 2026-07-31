import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { DESTINATARIOS_DS } from './datasources/destinatarios.datasource';
import { DestinatariosHttpDataSource } from './datasources/destinatarios.http.datasource';
import { DestinatariosMockDataSource } from './datasources/destinatarios.mock.datasource';

/** Wiring del feature destinatarios. Backend real disponible → 'local' (http) por defecto. */
export const provideDestinatariosFeature = (): Provider[] => [
  provideDataSource(DESTINATARIOS_DS, 'destinatarios', DestinatariosHttpDataSource, DestinatariosMockDataSource),
];
