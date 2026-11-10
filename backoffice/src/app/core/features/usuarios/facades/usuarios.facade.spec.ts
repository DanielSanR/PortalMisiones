import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { UsuarioService } from '@core/services/usuario.service';
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
