import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { ETIQUETAS_DS } from './datasources/etiquetas.datasource';
import { EtiquetasHttpDataSource } from './datasources/etiquetas.http.datasource';
import { EtiquetasMockDataSource } from './datasources/etiquetas.mock.datasource';

/** Wiring del feature etiquetas: `/api/tag` real (PPDT-5.8) o mock según `featureOverrides`. */
export const provideEtiquetasFeature = (): Provider[] => [
  provideDataSource(ETIQUETAS_DS, 'etiquetas', EtiquetasHttpDataSource, EtiquetasMockDataSource),
];
