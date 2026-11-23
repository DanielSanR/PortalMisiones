import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { GEOCODIFICACION_DS } from './datasources/geocodificacion.datasource';
import { GeocodificacionHttpDataSource } from './datasources/geocodificacion.http.datasource';
import { GeocodificacionMockDataSource } from './datasources/geocodificacion.mock.datasource';

/**
 * Wiring de la geocodificación: Nominatim (externo, URL en `environment.mapa.geocodificacion`) o mock según
 * `featureOverrides.geocodificacion` (mock en `ng serve`).
 */
export const provideGeocodificacionFeature = (): Provider[] => [
  provideDataSource(GEOCODIFICACION_DS, 'geocodificacion', GeocodificacionHttpDataSource, GeocodificacionMockDataSource),
];
