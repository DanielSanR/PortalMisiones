import { Provider } from '@angular/core';

/**
 * Wiring del feature dashboard. Sin DataSource propio hoy: `DashboardFacade` orquesta los
 * REPOSITORIES de otros features (todos `providedIn: 'root'`), así que no hay nada que registrar.
 * Se mantiene el hook por consistencia con el resto de los features (mismo patrón
 * `provide<Feature>Feature()` en `app.config.ts`) y por si el Home suma una fuente propia
 * (ej. analítica) en el Horizonte B.
 */
export const provideDashboardFeature = (): Provider[] => [];
