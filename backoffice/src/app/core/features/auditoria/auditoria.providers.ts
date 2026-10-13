import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { AUDITORIA_DS } from './datasources/auditoria.datasource';
import { AuditoriaMockDataSource } from './datasources/auditoria.mock.datasource';

/**
 * Wiring del feature auditoría. Bloqueada por backend → solo mock (se pasa como ambas impls
 * porque `featureOverrides.auditoria = 'mock'`). Al haber endpoint real: agregar HttpDataSource
 * como primer argumento y quitar el override.
 */
export const provideAuditoriaFeature = (): Provider[] => [
  provideDataSource(AUDITORIA_DS, 'auditoria', AuditoriaMockDataSource, AuditoriaMockDataSource),
];
