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
// Wiring de features: el composition root importa cada `<feature>.providers.ts` y NO el barrel
// `@features/<x>`. El barrel re-exporta el facade (`providedIn: 'root'`, con dependencias cross-feature)
// y esbuild no lo descarta del chunk inicial aunque acá no se use; importando el providers, cada facade
// queda en el chunk lazy de `pages`. Medido en la fase 5 de trámites (2026-10-13, `ng build`, budget
// inicial 900 kB): barrels en todos = 868 kB; barrels + `"sideEffects": false` (en `package.json` o en
// un `package.json` de `core/features`) = 868 kB, sin efecto (los facades decorados no cuentan como
// puros); providers en los 4 de trámites = 853 kB; providers en todos = 837 kB → se usa esto último.
// Es la única excepción a "cross-feature solo vía barrel": aplica al composition root, no a features.
import { provideUsuariosFeature } from './core/features/usuarios/usuarios.providers';
import { provideOrganismosFeature } from './core/features/organismos/organismos.providers';
import { provideRolesFeature } from './core/features/roles/roles.providers';
import { providePermisosFeature } from './core/features/permisos/permisos.providers';
import { provideLocalidadesFeature } from './core/features/localidades/localidades.providers';
import { provideCuentaFeature } from './core/features/cuenta/cuenta.providers';
import { provideEtiquetasFeature } from './core/features/etiquetas/etiquetas.providers';
import { provideModalidadesFeature } from './core/features/modalidades/modalidades.providers';
import { provideEventosDeVidaFeature } from './core/features/eventos-de-vida/eventos-de-vida.providers';
import { provideCategoriasFeature } from './core/features/categorias/categorias.providers';
import { provideTiposOrganismoFeature } from './core/features/tipos-organismo/tipos-organismo.providers';
import { provideDestinatariosFeature } from './core/features/destinatarios/destinatarios.providers';
import { providePlantillasFeature } from './core/features/plantillas/plantillas.providers';
import { provideAdopcionesFeature } from './core/features/adopciones/adopciones.providers';
import { provideFichasLocalesFeature } from './core/features/fichas-locales/fichas-locales.providers';
import { providePuntosAtencionFeature } from './core/features/puntos-atencion/puntos-atencion.providers';
import { provideDashboardFeature } from './core/features/dashboard/dashboard.providers';
import { provideAuditoriaFeature } from './core/features/auditoria/auditoria.providers';
import { provideFeedbackFeature } from './core/features/feedback/feedback.providers';

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
    ...providePlantillasFeature(),
    ...provideAdopcionesFeature(),
    ...provideFichasLocalesFeature(),
    ...providePuntosAtencionFeature(),
    ...provideDashboardFeature(),
    ...provideAuditoriaFeature(),
    ...provideFeedbackFeature(),
  ],
};
