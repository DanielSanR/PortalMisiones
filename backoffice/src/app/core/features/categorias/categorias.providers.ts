import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { CATEGORIAS_DS } from './datasources/categorias.datasource';
import { CategoriasHttpDataSource } from './datasources/categorias.http.datasource';
import { CategoriasMockDataSource } from './datasources/categorias.mock.datasource';

/** Wiring del feature categorias. Backend real disponible → 'local' (http) por defecto. */
export const provideCategoriasFeature = (): Provider[] => [
  provideDataSource(CATEGORIAS_DS, 'categorias', CategoriasHttpDataSource, CategoriasMockDataSource),
];
