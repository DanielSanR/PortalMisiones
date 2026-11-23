import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom, of, throwError } from 'rxjs';
import { ESCRIBIR_ROLES_PERMISOS_ACCESS } from '@core/constants/policy-overrides.constants';
import { AccessRule } from '@core/models/access-rule.model';
import { AuthUser } from '@core/models/auth.model';
import { AuthTokenService } from '@core/services/auth-token.service';
import { PermisosRepository } from '@features/permisos';
import { RolesRepository } from '../repositories/roles.repository';
import { RolesFacade } from './roles.facade';
import { RolVM } from '../models/role.vm';

/** `/api/role` se autoriza por ROL: la pantalla le pregunta al facade si quien mira puede escribir. */
describe('RolesFacade — puedeEscribir$ (sesión)', () => {
  let usuario$: BehaviorSubject<AuthUser | null>;
  let puede: boolean;
  let canAccess: jasmine.Spy<(rule: AccessRule) => boolean>;

  beforeEach(() => {
    usuario$ = new BehaviorSubject<AuthUser | null>(null);
    puede = false;
    canAccess = jasmine.createSpy('canAccess').and.callFake(() => puede);
    TestBed.configureTestingModule({
      providers: [
        { provide: RolesRepository, useValue: jasmine.createSpyObj<RolesRepository>('RolesRepository', ['list', 'listAllowed']) },
        { provide: PermisosRepository, useValue: jasmine.createSpyObj<PermisosRepository>('PermisosRepository', ['list']) },
        { provide: AuthTokenService, useValue: { getCurrentUser$: () => usuario$.asObservable(), canAccess } },
      ],
    });
  });

  it('evalúa la misma regla que la ruta de escritura (`ESCRIBIR_ROLES_PERMISOS_ACCESS`)', async () => {
    puede = true;

    expect(await firstValueFrom(TestBed.inject(RolesFacade).puedeEscribir$)).toBeTrue();
    expect(canAccess).toHaveBeenCalledWith(ESCRIBIR_ROLES_PERMISOS_ACCESS);
  });

  it('sin sesión o con un rol que solo lee: `false`', async () => {
    expect(await firstValueFrom(TestBed.inject(RolesFacade).puedeEscribir$)).toBeFalse();
  });

  it('sigue a la sesión: vuelve a evaluar la regla cuando cambia el usuario', () => {
    const vistos: boolean[] = [];
    const sub = TestBed.inject(RolesFacade).puedeEscribir$.subscribe((valor) => vistos.push(valor));

    puede = true;
    usuario$.next({ id: 'u-1' } as AuthUser);
    puede = false;
    usuario$.next(null);
    sub.unsubscribe();

    expect(vistos).toEqual([false, true, false]);
  });

  it('no lee la sesión al construirse: recién al suscribirse', () => {
    TestBed.inject(RolesFacade);

    expect(canAccess).not.toHaveBeenCalled();
  });
});

describe('RolesFacade — activate', () => {
  const PERMISO = { id: 'p-1', codigo: 'READ_USER', descripcion: 'Ver usuarios' };
  const PERMISO_NUEVO = { id: 'p-9', codigo: 'UPDATE_USER', descripcion: 'Editar usuarios' };
  /** La fila que tiene la lista en caché. */
  const INACTIVO: RolVM = {
    id: 'r-1', codigo: 'TEST_1', descripcion: 'Test', scopeTipo: 'global',
    asignablePorOrgAdmin: false, asignablePorBackoffice: true, activo: false, permisos: [PERMISO],
  };
  /** Lo que devuelve el backend ahora: otro administrador le cambió permisos y descripción mientras la lista estaba abierta. */
  const FRESCO: RolVM = { ...INACTIVO, descripcion: 'Test (revisado)', permisos: [PERMISO, PERMISO_NUEVO] };
  const OTRO: RolVM = { ...INACTIVO, id: 'r-2', codigo: 'OTRO', activo: true, permisos: [] };
  let repo: jasmine.SpyObj<RolesRepository>;
  let facade: RolesFacade;

  beforeEach(() => {
    repo = jasmine.createSpyObj<RolesRepository>('RolesRepository', ['list', 'listAllowed', 'getById', 'activate']);
    repo.list.and.returnValue(of([INACTIVO, OTRO]));
    repo.listAllowed.and.returnValue(of([]));
    repo.getById.and.returnValue(of(FRESCO));
    repo.activate.and.callFake((rol: RolVM) => of({ ...rol, activo: true }));
    TestBed.configureTestingModule({
      providers: [
        { provide: RolesRepository, useValue: repo },
        { provide: PermisosRepository, useValue: jasmine.createSpyObj<PermisosRepository>('PermisosRepository', ['list']) },
        { provide: AuthTokenService, useValue: { getCurrentUser$: () => of(null), canAccess: () => true } },
      ],
    });
    facade = TestBed.inject(RolesFacade);
  });

  it('pide el rol fresco y reactiva ESO (no la fila en caché): no revierte lo que otro administrador cambió', async () => {
    await firstValueFrom(facade.loadRoles());

    const activado = await firstValueFrom(facade.activate('r-1'));

    expect(repo.getById).toHaveBeenCalledOnceWith('r-1');
    expect(repo.activate).toHaveBeenCalledOnceWith(FRESCO);
    expect(activado.activo).toBeTrue();
    const roles = await firstValueFrom(facade.roles$);
    expect(roles.map((r) => [r.id, r.activo])).toEqual([['r-1', true], ['r-2', true]]);
    expect(roles[0].permisos).toEqual([PERMISO, PERMISO_NUEVO]);
    expect(roles[0].descripcion).toBe('Test (revisado)');
  });

  it('si el GET falla (404 `4059`: lo borraron) no hay PUT, la lista no cambia y el error llega a quien llamó', async () => {
    repo.getById.and.returnValue(throwError(() => ({ status: 404, error: { code: 4059 } })));
    await firstValueFrom(facade.loadRoles());

    await expectAsync(firstValueFrom(facade.activate('r-1'))).toBeRejected();

    expect(repo.activate).not.toHaveBeenCalled();
    expect((await firstValueFrom(facade.roles$))[0].activo).toBeFalse();
  });

  it('invalida la caché de roles asignables', async () => {
    const sub = facade.allowedRoles$.subscribe();
    repo.listAllowed.calls.reset();

    await firstValueFrom(facade.activate('r-1'));
    sub.unsubscribe();

    expect(repo.listAllowed).toHaveBeenCalledTimes(1);
  });

  it('si el PUT falla, la lista no cambia y el error llega a quien llamó', async () => {
    repo.activate.and.returnValue(throwError(() => ({ status: 404, error: { code: 4059 } })));
    await firstValueFrom(facade.loadRoles());

    await expectAsync(firstValueFrom(facade.activate('r-1'))).toBeRejected();

    expect((await firstValueFrom(facade.roles$))[0].activo).toBeFalse();
  });
});
