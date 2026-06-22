import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { USUARIOS_DS } from './datasources/usuarios.datasource';
import { UsuariosHttpDataSource } from './datasources/usuarios.http.datasource';
import { UsuariosMockDataSource } from './datasources/usuarios.mock.datasource';

/** Wiring del feature usuarios. La fuente (mock|local|prod) la resuelve environment. */
export const provideUsuariosFeature = (): Provider[] => [
  provideDataSource(USUARIOS_DS, 'usuarios', UsuariosHttpDataSource, UsuariosMockDataSource),
];
