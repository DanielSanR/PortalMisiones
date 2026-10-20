import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { FICHAS_LOCALES_DS } from './datasources/fichas-locales.datasource';
import { FichasLocalesHttpDataSource } from './datasources/fichas-locales.http.datasource';
import { FichasLocalesMockDataSource } from './datasources/fichas-locales.mock.datasource';

/**
 * Wiring del feature fichas por localidad: `/api/organism-procedure-location` real o mock según
 * `featureOverrides`.
 *
 * ⚠️ El override `'fichas-locales'` queda en `'mock'` (también en prod) hasta que el backend cierre
 * G-1: el response real no trae adopción, localidad, URL, requisitos ni costos, y como el PUT es
 * reemplazo total, editar una ficha real los borraría. Se activa JUNTO con `'puntos-atencion'`, para
 * no mezclar ids de fichas reales con ids mock (PLAN_TRAMITES_API.md §8).
 */
export const provideFichasLocalesFeature = (): Provider[] => [
  provideDataSource(FICHAS_LOCALES_DS, 'fichas-locales', FichasLocalesHttpDataSource, FichasLocalesMockDataSource),
];
