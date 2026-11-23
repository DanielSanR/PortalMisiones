import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { httpErrorInterceptor } from '@core/interceptors/http-error.interceptor';
import { HttpErrorService } from '@core/services/http-error.service';
import { RolVM } from '../models/role.vm';
import { RolesHttpDataSource } from './roles.http.datasource';

const INACTIVO: RolVM = {
  id: 'r 1', codigo: 'TEST_1', descripcion: 'Test', scopeTipo: 'global',
  asignablePorOrgAdmin: false, asignablePorBackoffice: true, activo: false,
  permisos: [
    { id: 'p-1', codigo: 'READ_USER', descripcion: 'Ver usuarios' },
    { id: 'p-2', codigo: 'UPDATE_USER', descripcion: 'Editar usuarios' },
  ],
};

/**
 * Reactivar un rol: el backend no tiene endpoint propio, es `PUT /api/role/{id}` con `active: true`
 * (`RoleService.updateRole` pisa TODOS los campos, permisos incluidos). De punta a punta con el interceptor real.
 */
describe('RolesHttpDataSource — activate', () => {
  let ds: RolesHttpDataSource;
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
    ds = new RolesHttpDataSource(TestBed.inject(HttpClient));
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('manda el rol completo con `active: true` (si faltaran los permisos, el PUT los borraría)', async () => {
    const pedido = firstValueFrom(ds.activate(INACTIVO));
    const req = backend.expectOne((r) => r.url.endsWith('/api/role/r%201'));

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      code: 'TEST_1',
      description: 'Test',
      scopeType: 'global',
      assignableByOrgAdmin: false,
      assignableByBackoffice: true,
      active: true,
      permissionsIds: ['p-1', 'p-2'],
    });
    req.flush({
      data: {
        id: 'r 1', code: 'TEST_1', description: 'Test', scopeType: 'global', assignableByOrgAdmin: false,
        assignableByBackoffice: true, active: true,
        permissions: [{ id: 'p-1', code: 'READ_USER', description: 'Ver usuarios' }, { id: 'p-2', code: 'UPDATE_USER', description: 'Editar usuarios' }],
      },
    });

    const activado = await pedido;
    expect(activado.activo).toBeTrue();
    expect(activado.permisos.map((p) => p.id)).toEqual(['p-1', 'p-2']);
  });

  it('GET recién hecho → PUT: un rol sin descripción (`null`) vuelve con `null`, no con `\'\'` (el PUT no cambia nada más)', async () => {
    const sinDescripcion = {
      id: 'r 1', code: 'TEST_1', description: null, scopeType: 'global', assignableByOrgAdmin: false,
      assignableByBackoffice: true, active: false, permissions: [{ id: 'p-1', code: 'READ_USER', description: 'Ver usuarios' }],
    };
    const lectura = firstValueFrom(ds.getById('r 1'));
    backend.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/role/r%201')).flush({ data: sinDescripcion });
    const fresco = await lectura;
    // La pantalla lo sigue viendo vacío.
    expect(fresco.descripcion).toBe('');

    const pedido = firstValueFrom(ds.activate(fresco));
    const req = backend.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/role/r%201'));
    expect(req.request.body).toEqual({
      code: 'TEST_1', description: null, scopeType: 'global', assignableByOrgAdmin: false,
      assignableByBackoffice: true, active: true, permissionsIds: ['p-1'],
    });
    req.flush({ data: { ...sinDescripcion, active: true } });
    expect((await pedido).activo).toBeTrue();
  });

  it('un error (404 `4059`) llega entero a la confirmación y no abre el diálogo global', async () => {
    const pedido = firstValueFrom(ds.activate(INACTIVO))
      .then(() => null, (e: unknown) => e as { status: number; error: { code: number } });
    backend.expectOne((r) => r.url.endsWith('/api/role/r%201'))
      .flush({ code: API_CODES.ROLE_NOT_FOUND, message: 'Rol no encontrado.' }, { status: 404, statusText: 'Not Found' });

    const err = await pedido;
    expect(err?.status).toBe(404);
    expect(err?.error.code).toBe(API_CODES.ROLE_NOT_FOUND);
    expect(errores.handleHttpError).not.toHaveBeenCalled();
  });
});
