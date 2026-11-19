import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { SKIP_ERROR_INTERCEPTOR } from '@core/interceptors/http-error.interceptor';
import { AttentionPointResponseDTO } from '../models/punto-atencion.dto';
import { PuntosAtencionHttpDataSource } from './puntos-atencion.http.datasource';

const API = `${environment.apiBaseUrl}/api/attention-point`;

const DTO: AttentionPointResponseDTO = {
  id: 'pa-1', organismProcedureLocationId: 'fl-1', name: 'Sede central', address: 'Bolívar 2152',
  contactInfo: null, openingHours: 'Lunes a viernes de 7 a 13', latitude: -27.367104, longitude: -55.896108, active: true,
};

const respuesta = <T>(data: T) => ({ code: 2013, message: 'ok', data });

describe('PuntosAtencionHttpDataSource', () => {
  let ds: PuntosAtencionHttpDataSource;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PuntosAtencionHttpDataSource],
    });
    ds = TestBed.inject(PuntosAtencionHttpDataSource);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sin filtro pide todo el alcance, sin query string', async () => {
    const lista = firstValueFrom(ds.list());
    const req = http.expectOne((r) => r.url === API);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(respuesta([DTO, { ...DTO, id: 'pa-2', active: false }]));
    expect((await lista).map((p) => p.activo)).toEqual([true, false]);
  });

  it('con ficha manda ?organismProcedureLocationId=<id>', async () => {
    const lista = firstValueFrom(ds.list({ fichaId: 'fl-1' }));
    const req = http.expectOne((r) => r.url === API);
    expect(req.request.urlWithParams).toBe(`${API}?organismProcedureLocationId=fl-1`);
    expect(req.request.context.get(SKIP_ERROR_INTERCEPTOR)).toBeTrue();
    req.flush(respuesta([DTO]));
    expect((await lista)[0].fichaId).toBe('fl-1');
  });

  it('un filtro vacío no manda el parámetro, y data nula es lista vacía', async () => {
    const lista = firstValueFrom(ds.list({}));
    const req = http.expectOne((r) => r.url === API);
    expect(req.request.params.has('organismProcedureLocationId')).toBeFalse();
    req.flush(respuesta(null));
    expect(await lista).toEqual([]);
  });

  it('roundtrip GET → PUT: reactivar un punto manda todos sus datos', async () => {
    const leido$ = firstValueFrom(ds.getById('pa-1'));
    http.expectOne(`${API}/pa-1`).flush(respuesta({ ...DTO, active: false }));
    const leido = await leido$;

    const guardado$ = firstValueFrom(ds.update(leido.id, {
      fichaId: leido.fichaId, nombre: leido.nombre, direccion: leido.direccion, contacto: leido.contacto ?? '',
      horarios: leido.horarios ?? '', latitud: leido.latitud!, longitud: leido.longitud!, activo: true,
    }));
    const req = http.expectOne(`${API}/pa-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      organismProcedureLocationId: 'fl-1', name: 'Sede central', address: 'Bolívar 2152', contactInfo: null,
      openingHours: 'Lunes a viernes de 7 a 13', latitude: -27.367104, longitude: -55.896108, active: true,
    });
    req.flush(respuesta(DTO));
    expect((await guardado$).activo).toBeTrue();
  });

  it('desactivar es DELETE con el id codificado', async () => {
    const hecho = firstValueFrom(ds.desactivar('a/b'));
    const req = http.expectOne(`${API}/a%2Fb`);
    expect(req.request.method).toBe('DELETE');
    req.flush(respuesta(null));
    expect(await hecho).toBeUndefined();
  });
});
