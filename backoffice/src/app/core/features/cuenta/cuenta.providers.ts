import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { CUENTA_DS } from './datasources/cuenta.datasource';
import { CuentaHttpDataSource } from './datasources/cuenta.http.datasource';
import { CuentaMockDataSource } from './datasources/cuenta.mock.datasource';

/** Wiring del feature cuenta. Backend real (email público) → 'local' (http) por defecto. */
export const provideCuentaFeature = (): Provider[] => [
  provideDataSource(CUENTA_DS, 'cuenta', CuentaHttpDataSource, CuentaMockDataSource),
];
