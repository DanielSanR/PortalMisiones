import { TestBed } from '@angular/core/testing';
import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { GeocodificacionHttpDataSource, MAX_RESULTADOS } from './geocodificacion.http.datasource';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

describe('GeocodificacionHttpDataSource (Nominatim)', () => {
  let ds: GeocodificacionHttpDataSource;
  let http: HttpTestingController;
  /** Simula los interceptores de la app (el de auth agrega el JWT): no tienen que tocar este pedido. */
  const interceptor = jasmine.createSpy('interceptor').and.callFake(((req, next) => next(req.clone({
    setHeaders: { Authorization: 'Bearer secreto' },
  }))) as HttpInterceptorFn);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([interceptor])),
        provideHttpClientTesting(),
        GeocodificacionHttpDataSource,
      ],
    });
    ds = TestBed.inject(GeocodificacionHttpDataSource);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('está disponible con la URL del entorno', () => {
    expect(ds.disponible).toBeTrue();
  });

  it('GET con la consulta, acotado a Misiones, pocos resultados y en español; mapea los lugares', async () => {
    const lugares = firstValueFrom(ds.buscar('Av. Uruguay 3150, Posadas, Misiones, Argentina'));
    const req = http.expectOne((r) => r.url === NOMINATIM);
    expect(req.request.method).toBe('GET');
    const p = req.request.params;
    expect(p.get('q')).toBe('Av. Uruguay 3150, Posadas, Misiones, Argentina');
    expect(p.get('format')).toBe('jsonv2');
    expect(p.get('countrycodes')).toBe('ar');
    expect(p.get('bounded')).toBe('1');
    expect(p.get('viewbox')).toBe('-56.07,-25.49,-53.63,-28.17');
    expect(p.get('limit')).toBe(String(MAX_RESULTADOS));
    expect(p.get('accept-language')).toBe('es');
    req.flush([{ place_id: 1, lat: '-27.5', lon: '-55.25', display_name: 'Posadas, Misiones, Argentina' }]);
    expect(await lugares).toEqual([{ id: '1', nombre: 'Posadas', detalle: 'Misiones', coordenadas: { latitud: -27.5, longitud: -55.25 } }]);
  });

  it('no pasa por los interceptores de la app: el JWT del backend no viaja a un tercero', () => {
    void firstValueFrom(ds.buscar('Oberá, Misiones, Argentina')).catch(() => undefined);
    const req = http.expectOne((r) => r.url === NOMINATIM);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(interceptor).not.toHaveBeenCalled();
    req.flush([]);
  });

  it('un error del servicio se propaga tal cual (lo cuenta la pantalla con texto propio)', async () => {
    const lugares = firstValueFrom(ds.buscar('Posadas'));
    http.expectOne((r) => r.url === NOMINATIM).flush('caído', { status: 503, statusText: 'Service Unavailable' });
    await expectAsync(lugares).toBeRejected();
  });
});
