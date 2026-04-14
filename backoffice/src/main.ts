import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { initMockAuth } from './app/core/mocks/mock-auth-init';

// Iniciamos el mock de auth
initMockAuth();

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
