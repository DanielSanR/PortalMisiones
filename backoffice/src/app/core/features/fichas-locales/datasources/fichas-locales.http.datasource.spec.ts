import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { SKIP_ERROR_INTERCEPTOR } from '@core/interceptors/http-error.interceptor';
import { OrganismProcedureLocationResponseDTO } from '../models/ficha-local.dto';
import { FichaLocalFormValue } from '../models/ficha-local.vm';
import { FichasLocalesHttpDataSource } from './fichas-locales.http.datasource';

const API = `${environment.apiBaseUrl}/api/organism-procedure-location`;

const DTO: OrganismProcedureLocationResponseDTO = {
  id: 'fl-1',
  organismProcedureId: 'op-1',
  locationId: 'loc-1',
  slug: 'obtener-licencia-posadas',
  url: 'https://www.posadas.gob.ar/licencias',
  requirements: 'DNI vigente.',
  costs: '$25.000',
  publicationStatus: 'PUBLICADO',
  active: true,
  currentVersionNumber: 3,
};

const respuesta = <T>(data: T) => ({ code: 2013, message: 'ok', data });

describe('FichasLocalesHttpDataSource', () => {
  let ds: FichasLocalesHttpDataSource;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), FichasLocalesHttpDataSource],
    });
    ds = TestBed.inject(FichasLocalesHttpDataSource);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('no es una fuente simulada', () => {
    expect(ds.fuenteSimulada).toBeFalse();
  });

  describe('list', () => {
    it('sin filtro pide todo el alcance, sin query string, y desenvuelve el ResponseDTO', async () => {
      const lista = firstValueFrom(ds.list());
      const req = http.expectOne((r) => r.url === API);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toEqual([]);
      req.flush(respuesta([DTO]));
      expect((await lista).map((f) => f.id)).toEqual(['fl-1']);
      expect((await lista)[0].adopcionId).toBe('op-1');
      expect((await lista)[0].requisitos).toBe('DNI vigente.');
    });

    it('con adopción manda ?organismProcedureId=<id>', async () => {
      const lista = firstValueFrom(ds.list({ adopcionId: 'op-1' }));
      const req = http.expectOne((r) => r.url === API);
      expect(req.request.params.get('organismProcedureId')).toBe('op-1');
      expect(req.request.urlWithParams).toBe(`${API}?organismProcedureId=op-1`);
      req.flush(respuesta([DTO]));
      expect((await lista).length).toBe(1);
    });

    it('un filtro vacío no manda el parámetro', () => {
      ds.list({}).subscribe();
      const req = http.expectOne((r) => r.url === API);
      expect(req.request.params.has('organismProcedureId')).toBeFalse();
      req.flush(respuesta([]));
    });

    it('data nula se trata como lista vacía', async () => {
      const lista = firstValueFrom(ds.list());
      http.expectOne(API).flush(respuesta(null));
      expect(await lista).toEqual([]);
    });

    it('no abre el diálogo global de error', () => {
      ds.list({ adopcionId: 'op-1' }).subscribe();
      const req = http.expectOne((r) => r.url === API);
      expect(req.request.context.get(SKIP_ERROR_INTERCEPTOR)).toBeTrue();
      req.flush(respuesta([]));
    });
  });

  it('getById codifica el id y devuelve la ficha completa', async () => {
    const ficha = firstValueFrom(ds.getById('a/b'));
    const req = http.expectOne(`${API}/a%2Fb`);
    expect(req.request.method).toBe('GET');
    req.flush(respuesta(DTO));
    expect((await ficha).localidadId).toBe('loc-1');
  });

  it('create hace POST con los obligatorios y sin publicationStatus', async () => {
    const form: FichaLocalFormValue = {
      adopcionId: 'op-1', localidadId: 'loc-1', slug: 'Obtener Licencia Posadas', url: '', requisitos: 'DNI', costos: '', activa: true,
    };
    const creada = firstValueFrom(ds.create(form));
    const req = http.expectOne(API);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      organismProcedureId: 'op-1', locationId: 'loc-1', slug: 'obtener-licencia-posadas',
      url: null, requirements: 'DNI', costs: null, active: true,
    });
    req.flush(respuesta({ ...DTO, publicationStatus: 'BORRADOR', currentVersionNumber: 1 }));
    expect((await creada).estado).toBe('BORRADOR');
  });

  it('roundtrip GET → PUT: lo que devolvió el GET viaja completo en el PUT, sin perder contenido', async () => {
    const leida$ = firstValueFrom(ds.getById('fl-1'));
    http.expectOne(`${API}/fl-1`).flush(respuesta(DTO));
    const leida = await leida$;

    // El form de edición se arma con la ficha leída y solo cambia los costos.
    const guardada$ = firstValueFrom(ds.update(leida.id, {
      adopcionId: leida.adopcionId,
      localidadId: leida.localidadId,
      slug: leida.slug,
      url: leida.url ?? '',
      requisitos: leida.requisitos ?? '',
      costos: '$30.000',
      activa: leida.activa,
    }));
    const req = http.expectOne(`${API}/fl-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      organismProcedureId: DTO.organismProcedureId,
      locationId: DTO.locationId,
      slug: DTO.slug,
      url: DTO.url,
      requirements: DTO.requirements,
      costs: '$30.000',
      active: DTO.active,
    });
    req.flush(respuesta({ ...DTO, costs: '$30.000', currentVersionNumber: 4 }));
    const guardada = await guardada$;
    expect(guardada.costos).toBe('$30.000');
    expect(guardada.estado).toBe('PUBLICADO');
    expect(guardada.version).toBe(4);
  });

  it('las transiciones son POST sin body a /{id}/<transición>', async () => {
    const publicada = firstValueFrom(ds.transicion('fl-1', 'publish'));
    const req = http.expectOne(`${API}/fl-1/publish`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(respuesta(DTO));
    expect((await publicada).estado).toBe('PUBLICADO');
  });

  it('desactivar es DELETE', async () => {
    const hecho = firstValueFrom(ds.desactivar('fl-1'));
    const req = http.expectOne(`${API}/fl-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(respuesta(null));
    expect(await hecho).toBeUndefined();
  });

  it('propaga el error del backend tal cual (lo traduce la pantalla)', async () => {
    const alta = firstValueFrom(ds.create({
      adopcionId: 'op-vencida', localidadId: 'loc-1', slug: 'x', url: '', requisitos: '', costos: '', activa: true,
    }));
    http.expectOne(API).flush(
      { code: 4073, message: 'El objeto OrganismProcedure con el identificador op-vencida no existe.' },
      { status: 404, statusText: 'Not Found' },
    );
    await expectAsync(alta).toBeRejectedWith(jasmine.objectContaining({ status: 404 }));
  });

  it('la dirección pública apunta a /api/procedure/{slug} codificado', () => {
    expect(ds.urlPublica('mi slug')).toBe(`${environment.apiBaseUrl}/api/procedure/mi%20slug`);
  });
});
