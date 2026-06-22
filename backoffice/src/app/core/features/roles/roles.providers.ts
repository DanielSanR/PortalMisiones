import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { ROLES_DS } from './datasources/roles.datasource';
import { RolesHttpDataSource } from './datasources/roles.http.datasource';
import { RolesMockDataSource } from './datasources/roles.mock.datasource';

/** Wiring del feature roles. Backend real disponible → 'local' (http) por defecto. */
export const provideRolesFeature = (): Provider[] => [
  provideDataSource(ROLES_DS, 'roles', RolesHttpDataSource, RolesMockDataSource),
];
