import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { PERMISOS_DS } from './datasources/permisos.datasource';
import { PermisosHttpDataSource } from './datasources/permisos.http.datasource';
import { PermisosMockDataSource } from './datasources/permisos.mock.datasource';

/** Wiring del feature permisos. Backend real disponible → 'local' (http) por defecto. */
export const providePermisosFeature = (): Provider[] => [
  provideDataSource(PERMISOS_DS, 'permisos', PermisosHttpDataSource, PermisosMockDataSource),
];
