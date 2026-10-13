import { Provider } from '@angular/core';
import { provideDataSource } from '@core/config/data-source.config';
import { PLANTILLAS_DS } from './datasources/plantillas.datasource';
import { PlantillasHttpDataSource } from './datasources/plantillas.http.datasource';
import { PlantillasMockDataSource } from './datasources/plantillas.mock.datasource';

/** Wiring del feature plantillas: `/api/procedure-template` real o mock según `featureOverrides`. */
export const providePlantillasFeature = (): Provider[] => [
  provideDataSource(PLANTILLAS_DS, 'plantillas', PlantillasHttpDataSource, PlantillasMockDataSource),
];
