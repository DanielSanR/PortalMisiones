import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { registerLocaleData } from '@angular/common';
import { LOCALE_ID } from '@angular/core';
import localeEsAr from '@angular/common/locales/es-AR';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { mockApiInterceptor } from './core/mocks/mock-api.interceptor';
import { provideUsuariosFeature } from './core/features/usuarios';
import { provideOrganismosFeature } from './core/features/organismos';
import { provideRolesFeature } from './core/features/roles';
import { providePermisosFeature } from './core/features/permisos';
import { provideLocalidadesFeature } from './core/features/localidades';
import { provideCuentaFeature } from './core/features/cuenta';
import { provideEtiquetasFeature } from './core/features/etiquetas';
import { provideModalidadesFeature } from './core/features/modalidades';
import { provideEventosDeVidaFeature } from './core/features/eventos-de-vida';
import { provideCategoriasFeature } from './core/features/categorias';
import { provideTiposOrganismoFeature } from './core/features/tipos-organismo';
import { provideDestinatariosFeature } from './core/features/destinatarios';
import { provideTramitesFeature } from './core/features/tramites';
// Trámites: se importa el `*.providers.ts` y no el barrel. El barrel re-exporta el facade (singleton
// `root` con muchas dependencias cross-feature) y el builder no lo descarta del chunk inicial aunque
// acá no se use: importado así, cada facade queda en el chunk lazy de `pages` (budget inicial 900 kB).
import { providePlantillasFeature } from './core/features/plantillas/plantillas.providers';
import { provideAdopcionesFeature } from './core/features/adopciones/adopciones.providers';
import { provideFichasLocalesFeature } from './core/features/fichas-locales/fichas-locales.providers';
import { providePuntosAtencionFeature } from './core/features/puntos-atencion/puntos-atencion.providers';
import { provideDashboardFeature } from './core/features/dashboard';
import { provideAuditoriaFeature } from './core/features/auditoria';
import { provideFeedbackFeature } from './core/features/feedback';

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

    // ── Wiring por feature (cada feature provee sus DataSources; la fuente la resuelve environment) ──
    ...provideUsuariosFeature(),
    ...provideOrganismosFeature(),
    ...provideRolesFeature(),
    ...providePermisosFeature(),
    ...provideLocalidadesFeature(),
    ...provideCuentaFeature(),
    ...provideEtiquetasFeature(),
    ...provideModalidadesFeature(),
    ...provideEventosDeVidaFeature(),
    ...provideCategoriasFeature(),
    ...provideTiposOrganismoFeature(),
    ...provideDestinatariosFeature(),
    ...provideTramitesFeature(),
    ...providePlantillasFeature(),
    ...provideAdopcionesFeature(),
    ...provideFichasLocalesFeature(),
    ...providePuntosAtencionFeature(),
    ...provideDashboardFeature(),
    ...provideAuditoriaFeature(),
    ...provideFeedbackFeature(),
  ],
};
