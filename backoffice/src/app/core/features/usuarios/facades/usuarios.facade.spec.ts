import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { UsuarioService } from '@core/services/usuario.service';
import { AuthTokenService } from '@core/services/auth-token.service';
import { AuthUser } from '@core/models/auth.model';
import { UserRole } from '@core/enums/user-role.enum';
import { OrganismosRepository } from '@features/organismos';
import { RolesRepository } from '@features/roles';
import { USUARIOS_DS, UsuariosDataSource } from '../datasources/usuarios.datasource';
import { UsuariosHttpDataSource } from '../datasources/usuarios.http.datasource';
import { UsuariosMockDataSource } from '../datasources/usuarios.mock.datasource';
import { UserResponseDTO } from '../models/usuario.dto';
import { UsuariosFacade } from './usuarios.facade';

function facadeCon(ds: UsuariosDataSource): UsuariosFacade {
  TestBed.configureTestingModule({
    providers: [
      { provide: USUARIOS_DS, useValue: ds },
      { provide: OrganismosRepository, useValue: {} },
      { provide: RolesRepository, useValue: {} },
    ],
  });
  return TestBed.inject(UsuariosFacade);
}

/** Forma real de `GET /api/user` en staging (2026-11-03): sin rol ni asignaciones (G-13). */
function dto(parcial: Partial<UserResponseDTO> = {}): UserResponseDTO {
  return {
    id: 'u-1', email: 'ana@misiones.gob.ar', cuit: null, cuil: null, accountActive: true,
    accountNonLocked: true, failedAttempts: 0, lockeTime: null, role: null, activeAssignments: [],
    profileComplete: false, ...parcial,
  };
}

describe('UsuariosFacade · fuente real (GET /api/user)', () => {
  let http: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post', 'put', 'patch', 'delete']);
  });

  it('ofrece las acciones de cuenta, pero no la edición ni el borrado definitivo (G-13)', () => {
    const facade = facadeCon(new UsuariosHttpDataSource(http));
    expect(facade.accionesDeCuentaDisponibles).toBeTrue();
    expect(facade.edicionDisponible).toBeFalse();
    expect(facade.borradoDefinitivoDisponible).toBeFalse();
  });

  it('lista desde el backend sin inventar el rol cuando no viene', async () => {
    http.get.and.returnValue(of({ code: 2013, message: '', data: [
      dto(),
      dto({ id: 'u-2', role: { code: 'ADMIN_ORGANIZATION' } as UserResponseDTO['role'] }),
    ] }));
    const facade = facadeCon(new UsuariosHttpDataSource(http));
    const usuarios = await firstValueFrom(facade.loadUsuarios());
    expect(http.get.calls.mostRecent().args[0]).toMatch(/\/api\/user$/);
    expect(usuarios.map((u) => u.rol)).toEqual([null, UserRole.ADMIN_ORGANIZATION]);
  });

  it('activar/desactivar manda el estado pedido (nunca un toggle) y lo refleja en la fila', async () => {
    http.get.and.returnValue(of({ code: 2013, message: '', data: [dto({ accountActive: true })] }));
    http.put.and.returnValue(of({}));
    const facade = facadeCon(new UsuariosHttpDataSource(http));
    await firstValueFrom(facade.loadUsuarios());
    await firstValueFrom(facade.setAccountStatus('u-1', false));
    await firstValueFrom(facade.setAccountStatus('u-1', false));
    expect(http.put.calls.allArgs().map((a) => a[1])).toEqual([{ accountActive: false }, { accountActive: false }]);
    expect(http.put.calls.mostRecent().args[0]).toMatch(/\/api\/user\/u-1\/status-account$/);
    expect((await firstValueFrom(facade.usuarios$))[0].activo).toBeFalse();
  });

  it('el alta manda el organismo como `organizationId` solo si el form lo trae', async () => {
    http.post.and.returnValue(of({ code: 2001, message: '', data: dto() }));
    const facade = facadeCon(new UsuariosHttpDataSource(http));
    const form = { nombre: 'Ana', apellido: 'Paz', email: 'ana@misiones.gob.ar', password: 'Clave1234', rol: 'rol-uuid' };

    await firstValueFrom(facade.create({ ...form, organismoId: 'org-uuid' }));
    expect(http.post.calls.mostRecent().args[0]).toMatch(/\/api\/user$/);
    expect(http.post.calls.mostRecent().args[1]).toEqual({
      email: 'ana@misiones.gob.ar', password: 'Clave1234', role: 'rol-uuid', organizationId: 'org-uuid',
      profileDto: { firstName: 'Ana', lastName: 'Paz' },
    });

    // Rol global: sin organismo. El backend no lo rechazaría, así que no tiene que viajar.
    await firstValueFrom(facade.create({ ...form, organismoId: null }));
    expect(http.post.calls.mostRecent().args[1].organizationId).toBeUndefined();
  });

  it('asignar un rol manda solo lo que el form trae y refleja en la fila el rol vigente', async () => {
    http.get.and.returnValue(of({ code: 2013, message: '', data: [dto()] }));
    http.post.and.returnValue(of({ code: 2001, message: '', data: dto({ role: { code: 'AGENT' } as UserResponseDTO['role'] }) }));
    const facade = facadeCon(new UsuariosHttpDataSource(http));
    await firstValueFrom(facade.loadUsuarios());

    await firstValueFrom(facade.asignarRol('u-1', {
      rolId: 'rol-uuid', organismoId: 'org-uuid', vigenteDesde: '2026-12-01', vigenteHasta: null,
    }));
    expect(http.post.calls.mostRecent().args[0]).toMatch(/\/api\/user\/u-1\/role-assignments$/);
    expect(http.post.calls.mostRecent().args[1]).toEqual({
      roleId: 'rol-uuid', organismId: 'org-uuid', effectiveFrom: '2026-12-01', effectiveTo: undefined,
    });
    expect((await firstValueFrom(facade.usuarios$))[0].rol).toBe(UserRole.AGENT);

    // Rol global, desde hoy y sin fin: solo viaja el rol.
    await firstValueFrom(facade.asignarRol('u-1', { rolId: 'rol-uuid', organismoId: null, vigenteDesde: null, vigenteHasta: null }));
    expect(JSON.parse(JSON.stringify(http.post.calls.mostRecent().args[1]))).toEqual({ roleId: 'rol-uuid' });
  });

  it('si la asignación falla, la fila no cambia y el error llega a quien llamó', async () => {
    http.get.and.returnValue(of({ code: 2013, message: '', data: [dto({ role: { code: 'AGENT' } as UserResponseDTO['role'] })] }));
    http.post.and.returnValue(throwError(() => ({ status: 409, error: { code: 4081, message: '' } })));
    const facade = facadeCon(new UsuariosHttpDataSource(http));
    await firstValueFrom(facade.loadUsuarios());

    await expectAsync(firstValueFrom(facade.asignarRol('u-1', {
      rolId: 'rol-uuid', organismoId: 'org-uuid', vigenteDesde: null, vigenteHasta: null,
    }))).toBeRejectedWith(jasmine.objectContaining({ status: 409 }));
    expect((await firstValueFrom(facade.usuarios$))[0].rol).toBe(UserRole.AGENT);
  });

  it('edición y borrado definitivo fallan explícitamente, sin tocar el backend', async () => {
    const facade = facadeCon(new UsuariosHttpDataSource(http));
    const form = { nombre: 'A', apellido: 'B', email: 'a@b.com', password: '', rol: '', organismoId: null };
    await expectAsync(firstValueFrom(facade.update('u-1', form))).toBeRejectedWithError(/editar/);
    await expectAsync(firstValueFrom(facade.deleteDefinitive('u-1'))).toBeRejectedWithError(/G-13/);
    expect(http.put).not.toHaveBeenCalled();
    expect(http.delete).not.toHaveBeenCalled();
  });
});

describe('UsuariosFacade · fuente mock', () => {
  it('ofrece todo (dev/QA)', () => {
    const servicioMock = jasmine.createSpyObj<UsuarioService>('UsuarioService', ['getById']);
    const facade = facadeCon(new UsuariosMockDataSource(servicioMock));
    expect(facade.accionesDeCuentaDisponibles).toBeTrue();
    expect(facade.edicionDisponible).toBeTrue();
    expect(facade.borradoDefinitivoDisponible).toBeTrue();
  });
});

describe('UsuariosFacade · sesion$', () => {
  function facadeConSesion(usuario: Partial<AuthUser> | null): UsuariosFacade {
    TestBed.configureTestingModule({
      providers: [
        { provide: USUARIOS_DS, useValue: {} },
        { provide: OrganismosRepository, useValue: {} },
        { provide: RolesRepository, useValue: {} },
        { provide: AuthTokenService, useValue: { getCurrentUser$: () => of(usuario as AuthUser | null) } },
      ],
    });
    return TestBed.inject(UsuariosFacade);
  }

  it('un superadmin se reconoce por su rol y no depende de un organismo', async () => {
    const facade = facadeConSesion({ id: 'u-1', email: 'sa@misiones.gob.ar', role: UserRole.SUPERADMIN, organismoId: null });
    expect(await firstValueFrom(facade.sesion$)).toEqual({
      usuarioId: 'u-1', email: 'sa@misiones.gob.ar', esSuperAdmin: true, organismoId: null,
    });
  });

  it('un usuario de organismo no es superadmin y trae su organismo', async () => {
    const facade = facadeConSesion({ id: 'u-2', email: 'ana@misiones.gob.ar', role: UserRole.ADMIN_ORGANIZATION, organismoId: 'org-1' });
    expect(await firstValueFrom(facade.sesion$)).toEqual({
      usuarioId: 'u-2', email: 'ana@misiones.gob.ar', esSuperAdmin: false, organismoId: 'org-1',
    });
  });

  it('sin sesión no hay usuario ni privilegios', async () => {
    const facade = facadeConSesion(null);
    expect(await firstValueFrom(facade.sesion$)).toEqual({
      usuarioId: null, email: null, esSuperAdmin: false, organismoId: null,
    });
  });
});
