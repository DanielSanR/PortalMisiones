import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { httpErrorInterceptor } from '@core/interceptors/http-error.interceptor';
import { HttpErrorService } from '@core/services/http-error.service';
import { OrganismosHttpDataSource } from './organismos.http.datasource';

/**
 * De punta a punta: datasource real → `httpErrorInterceptor` real. La ficha cuenta su propio error de carga
 * (y distingue "no existe"): la lectura de UN organismo no puede abrir además el diálogo global.
 */
describe('OrganismosHttpDataSource — lectura de un organismo', () => {
  let ds: OrganismosHttpDataSource;
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
    ds = new OrganismosHttpDataSource(TestBed.inject(HttpClient));
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('pide `GET /api/organism/{id}` (id codificado) y desenvuelve el `ResponseDTO`', async () => {
    const pedido = firstValueFrom(ds.getById('o 1'));
    const req = backend.expectOne((r) => r.url.endsWith('/api/organism/o%201'));
    expect(req.request.method).toBe('GET');
    req.flush({ data: { id: 'o 1', name: 'Ministerio de Salud', acronym: 'MSP', typeId: 't-1', active: true } });

    expect((await pedido).id).toBe('o 1');
  });

  it('un organismo que no existe (404 `4058`) llega entero a la pantalla y no abre el diálogo global', async () => {
    const pedido = firstValueFrom(ds.getById('no-existe'))
      .then(() => null, (e: unknown) => e as { status: number; error: { code: number } });
    backend.expectOne((r) => r.url.endsWith('/api/organism/no-existe'))
      .flush({ code: API_CODES.ORGANISM_NOT_FOUND, message: 'Organización no encontrada.' }, { status: 404, statusText: 'Not Found' });

    const err = await pedido;

    expect(err?.status).toBe(404);
    expect(err?.error.code).toBe(API_CODES.ORGANISM_NOT_FOUND);
    expect(errores.handleHttpError).not.toHaveBeenCalled();
  });
});
