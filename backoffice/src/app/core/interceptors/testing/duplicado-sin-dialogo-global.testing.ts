import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { API_CODES } from '../../constants/api-codes.constants';
import { HttpErrorService } from '../../services/http-error.service';
import { httpErrorInterceptor } from '../http-error.interceptor';

/** Una escritura (alta o edición) de un formulario con unicidad, contra su datasource HTTP real. */
export interface EscrituraConUnicidad {
  /** "alta", "edición"… */
  nombre: string;
  /** La URL que tiene que pedir. */
  url: RegExp;
  /** Dispara la escritura con el `HttpClient` de la prueba (el datasource se crea acá: `new XHttpDataSource(http)`). */
  pedir: (http: HttpClient) => Observable<unknown>;
}

/**
 * Suite compartida, solo para specs (no entra al build de la app: nadie la importa desde `main.ts`).
 *
 * De punta a punta: datasource HTTP real → `httpErrorInterceptor` real. Desde el backend `586b670` un
 * duplicado responde HTTP 409 (antes 400) con el mismo código `4072`. En ningún formulario con unicidad
 * puede abrirse además el diálogo global: el error llega entero al form, que lo cuenta en su campo.
 *
 * Cada feature la invoca desde el spec de SU datasource HTTP (`<feature>.http.datasource.spec.ts`), así
 * ninguna prueba entra a los internals de otro feature por ruta profunda.
 */
export function describeDuplicadoSinDialogoGlobal(formulario: string, escrituras: EscrituraConUnicidad[]): void {
  describe(`${formulario} — duplicado 409/4072: no abre además el diálogo global`, () => {
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

    escrituras.forEach(({ nombre, url, pedir }) => {
      [409, 400].forEach((status) => {
        it(`${nombre}: HTTP ${status} + 4072 llega al formulario y no abre el diálogo global`, async () => {
          const pedido = firstValueFrom(pedir(http))
            .then(() => null, (e: unknown) => e as { status: number; error: { code: number } });
          backend.expectOne((req) => url.test(req.url))
            .flush({ code: API_CODES.ENTITY_CONFLICT, message: 'El objeto X con el identificador y existe.' }, { status, statusText: 'Error' });

          const err = await pedido;

          expect(err?.status).toBe(status);
          expect(err?.error.code).toBe(API_CODES.ENTITY_CONFLICT);
          expect(errores.handleHttpError).not.toHaveBeenCalled();
        });
      });
    });
  });
}
