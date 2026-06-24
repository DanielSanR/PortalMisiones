import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { initMockAuth } from './app/core/mocks/mock-auth-init';
import { environment } from './environments/environment';

// Sesión mock SOLO en modo 'mock' (dev offline). Con 'local'/'prod' se usa login real contra
// el backend; sembrar un token falso rompería las llamadas reales (401).
if (environment.dataSource === 'mock') {
  initMockAuth();
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
