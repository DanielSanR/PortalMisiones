import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { HttpErrorService } from '../services/http-error.service';
import { httpErrorInterceptor, sinDialogoGlobal } from './http-error.interceptor';

/**
 * El diálogo global de error no puede duplicar lo que ya cuenta el formulario. El backend `586b670` pasó
 * los duplicados (`4072`) de HTTP 400 a 409: el interceptor no decide por status, solo por el contexto
 * `SKIP_ERROR_INTERCEPTOR`.
 */
describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let errores: jasmine.SpyObj<HttpErrorService>;

  beforeEach(() => {
    errores = jasmine.createSpyObj<HttpErrorService>('HttpErrorService', ['handleHttpError']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: HttpErrorService, useValue: errores },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const DUPLICADO = { code: 4072, message: 'El objeto Plantilla con el identificador x existe.' };

  [409, 400, 403].forEach((status) => {
    it(`con sinDialogoGlobal(), un ${status} no abre el diálogo global y el error llega a quien llamó`, async () => {
      const pedido = firstValueFrom(http.post('/api/procedure-template', {}, sinDialogoGlobal())).catch((e: unknown) => e);
      backend.expectOne('/api/procedure-template').flush(DUPLICADO, { status, statusText: 'Error' });

      const err = await pedido as { status: number; error: { code: number } };

      expect(err.status).toBe(status);
      expect(err.error.code).toBe(4072);
      expect(errores.handleHttpError).not.toHaveBeenCalled();
    });
  });

  it('sin el contexto, un 409 sí abre el diálogo global (por eso las escrituras lo llevan)', async () => {
    const pedido = firstValueFrom(http.post('/api/otra-cosa', {})).catch((e: unknown) => e);
    backend.expectOne('/api/otra-cosa').flush(DUPLICADO, { status: 409, statusText: 'Conflict' });
    await pedido;

    expect(errores.handleHttpError).toHaveBeenCalledTimes(1);
  });

  it('un 401 nunca abre el diálogo: lo gestiona el authInterceptor', async () => {
    const pedido = firstValueFrom(http.get('/api/algo')).catch((e: unknown) => e);
    backend.expectOne('/api/algo').flush({}, { status: 401, statusText: 'Unauthorized' });
    await pedido;

    expect(errores.handleHttpError).not.toHaveBeenCalled();
  });
});
