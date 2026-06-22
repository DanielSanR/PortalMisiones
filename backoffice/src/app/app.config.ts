import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { registerLocaleData } from '@angular/common';
import { LOCALE_ID } from '@angular/core';
import localeEsAr from '@angular/common/locales/es-AR';

import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { mockApiInterceptor } from './core/mocks/mock-api.interceptor';
import { provideUsuariosFeature } from './core/features/usuarios';
import { provideOrganismosFeature } from './core/features/organismos';
import { provideRolesFeature } from './core/features/roles';
import { providePermisosFeature } from './core/features/permisos';
import { provideMunicipiosFeature } from './core/features/municipios';
import { provideCuentaFeature } from './core/features/cuenta';
import { provideEtiquetasFeature } from './core/features/etiquetas';

registerLocaleData(localeEsAr, 'es-AR');

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    // Orden: en la RESPUESTA los interceptores corren en orden inverso, por lo que
    // authInterceptor (último) procesa el 401 ANTES que httpErrorInterceptor muestre diálogo.
    provideHttpClient(
      withInterceptors([mockApiInterceptor, httpErrorInterceptor, authInterceptor])
    ),
    { provide: LOCALE_ID, useValue: 'es-AR' },
    provideCharts(withDefaultRegisterables()),

    // ── Wiring por feature (cada feature provee sus DataSources; la fuente la resuelve environment) ──
    ...provideUsuariosFeature(),
    ...provideOrganismosFeature(),
    ...provideRolesFeature(),
    ...providePermisosFeature(),
    ...provideMunicipiosFeature(),
    ...provideCuentaFeature(),
    ...provideEtiquetasFeature(),
  ],
};
