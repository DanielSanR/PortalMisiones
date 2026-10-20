import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { FEEDBACK_DS } from './datasources/feedback.datasource';
import { FeedbackMockDataSource } from './datasources/feedback.mock.datasource';

/**
 * Wiring del feature feedback. Bloqueado por backend → solo mock (se pasa como ambas impls
 * porque `featureOverrides.feedback = 'mock'`). Al haber endpoint real: agregar HttpDataSource
 * como primer argumento y quitar el override.
 */
export const provideFeedbackFeature = (): Provider[] => [
  provideDataSource(FEEDBACK_DS, 'feedback', FeedbackMockDataSource, FeedbackMockDataSource),
];
