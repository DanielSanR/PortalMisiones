import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { ETIQUETAS_DS } from './datasources/etiquetas.datasource';
import { EtiquetasMockDataSource } from './datasources/etiquetas.mock.datasource';

/**
 * Wiring del feature etiquetas. Bloqueada por backend → solo mock (se pasa como ambas impls
 * porque `featureOverrides.etiquetas = 'mock'`). Al haber endpoint real: agregar HttpDataSource
 * como primer argumento y quitar el override.
 */
export const provideEtiquetasFeature = (): Provider[] => [
  provideDataSource(ETIQUETAS_DS, 'etiquetas', EtiquetasMockDataSource, EtiquetasMockDataSource),
];
