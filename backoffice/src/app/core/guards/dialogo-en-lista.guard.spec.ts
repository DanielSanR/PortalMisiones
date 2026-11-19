import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, convertToParamMap, provideRouter } from '@angular/router';
import { AuthTokenService } from '@core/services/auth-token.service';
import { environment } from '@env/environment';
import { UserRole } from '@core/enums/user-role.enum';
import { redirigirAlDialogo, validarDialogoDeLista } from './dialogo-en-lista.guard';
import { EDITAR_USUARIO_ACCESS } from '../constants/policy-overrides.constants';

const guard = validarDialogoDeLista({ nuevo: 'CREATE_CATEGORY', editar: 'UPDATE_CATEGORY' });
const soloSuperadmin = { requireRoles: [UserRole.SUPERADMIN] };
const guardPorRol = validarDialogoDeLista({ nuevo: soloSuperadmin, editar: soloSuperadmin });

describe('validarDialogoDeLista', () => {
  const bypassOriginal = environment.bypassAuthGuards;

  function correr(url: string, permissions: string[], roles: UserRole[] = [], g = guard, organismoPropio = false): boolean | UrlTree {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthTokenService, useValue: { getAuthzContext: () => ({ permissions, roles, organismoPropio }) } },
      ],
    });
    const query: Record<string, string> = {};
    new URLSearchParams(url.split('?')[1] ?? '').forEach((valor, clave) => { query[clave] = valor; });
    const route = { queryParamMap: convertToParamMap(query) } as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(
      () => g(route, { url } as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  beforeEach(() => { environment.bypassAuthGuards = false; });
  afterEach(() => { environment.bypassAuthGuards = bypassOriginal; });

  it('sin pedido de diálogo deja pasar', () => {
    expect(correr('/dashboard/categorias/lista', ['DELETE_CATEGORY'])).toBeTrue();
  });

  it('deja pasar el alta a quien puede crear', () => {
    expect(correr('/dashboard/categorias/lista?dialogo=nuevo', ['CREATE_CATEGORY'])).toBeTrue();
  });

  it('sin permiso de crear, entra a la lista sin el pedido de alta y conserva el resto', () => {
    const destino = correr('/dashboard/categorias/lista?dialogo=nuevo&parentId=edu&q=salud', ['UPDATE_CATEGORY']);
    expect(destino instanceof UrlTree).toBeTrue();
    expect((destino as UrlTree).toString()).toBe('/dashboard/categorias/lista?q=salud');
  });

  it('sin permiso de editar, descarta el pedido de edición', () => {
    const destino = correr('/dashboard/categorias/lista?dialogo=editar&id=edu', ['CREATE_CATEGORY']);
    expect((destino as UrlTree).toString()).toBe('/dashboard/categorias/lista');
  });

  it('con una regla por rol, solo pasa el pedido de quien tiene el rol', () => {
    const url = '/dashboard/permisos/lista?dialogo=nuevo';
    expect(correr(url, [], [UserRole.SUPERADMIN], guardPorRol)).toBeTrue();
    TestBed.resetTestingModule();
    const destino = correr(url, [], [UserRole.ADMIN_BACKOFFICE], guardPorRol);
    expect((destino as UrlTree).toString()).toBe('/dashboard/permisos/lista');
  });
});

describe('redirigirAlDialogo', () => {
  function redirigir(modo: 'nuevo' | 'editar', params: Record<string, string>, query: Record<string, string> = {}): UrlTree {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const route = { params, queryParamMap: convertToParamMap(query) } as unknown as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(
      () => redirigirAlDialogo('/dashboard/usuarios/lista', modo)(route, {} as RouterStateSnapshot),
    ) as UrlTree;
  }

  it('usuarios/nuevo va a la lista pidiendo el alta', () => {
    expect(redirigir('nuevo', {}).toString()).toBe('/dashboard/usuarios/lista?dialogo=nuevo');
  });

  it('usuarios/editar/:id va a la lista pidiendo la edición de ese usuario', () => {
    expect(redirigir('editar', { id: 'u-1' }).toString()).toBe('/dashboard/usuarios/lista?dialogo=editar&id=u-1');
  });
});

describe('validarDialogoDeLista — usuarios', () => {
  const bypassOriginal = environment.bypassAuthGuards;
  const guardUsuarios = validarDialogoDeLista({ nuevo: 'CREATE_USER', editar: EDITAR_USUARIO_ACCESS });

  function correr(url: string, permissions: string[], roles: UserRole[], organismoPropio = false): boolean | UrlTree {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthTokenService, useValue: { getAuthzContext: () => ({ permissions, roles, organismoPropio }) } },
      ],
    });
    const query: Record<string, string> = {};
    new URLSearchParams(url.split('?')[1] ?? '').forEach((valor, clave) => { query[clave] = valor; });
    const route = { queryParamMap: convertToParamMap(query) } as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(
      () => guardUsuarios(route, { url } as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  beforeEach(() => { environment.bypassAuthGuards = false; });
  afterEach(() => { environment.bypassAuthGuards = bypassOriginal; });

  const ALTA = '/dashboard/usuarios/lista?dialogo=nuevo';
  const EDICION = '/dashboard/usuarios/lista?dialogo=editar&id=u-1';

  it('el alta exige CREATE_USER con sus prerrequisitos (READ_ORGANISM y un rol admin), como la ruta usuarios/nuevo', () => {
    expect(correr(ALTA, ['READ_USER', 'CREATE_USER', 'READ_ORGANISM'], [UserRole.ADMIN_BACKOFFICE])).toBeTrue();

    TestBed.resetTestingModule();
    const sinOrganismos = correr(ALTA, ['READ_USER', 'CREATE_USER'], [UserRole.ADMIN_BACKOFFICE]);
    expect((sinOrganismos as UrlTree).toString()).toBe('/dashboard/usuarios/lista');

    TestBed.resetTestingModule();
    const sinPermiso = correr(ALTA, ['READ_USER', 'READ_ORGANISM'], [UserRole.ADMIN_BACKOFFICE]);
    expect((sinPermiso as UrlTree).toString()).toBe('/dashboard/usuarios/lista');
  });

  it('con el organismo en la sesión (G-2), el alta no exige READ_ORGANISM a un Administrador de Organismo', () => {
    expect(correr(ALTA, ['READ_USER', 'CREATE_USER'], [UserRole.ADMIN_ORGANIZATION], true)).toBeTrue();
  });

  it('sin organismo en la sesión (backend anterior) el alta sigue exigiendo READ_ORGANISM, como antes', () => {
    expect(correr(ALTA, ['READ_USER', 'CREATE_USER'], [UserRole.ADMIN_ORGANIZATION], false)).not.toBeTrue();
  });

  it('la edición exige EDITAR_USUARIO_ACCESS: UPDATE_USER + READ_ORGANISM + rol admin', () => {
    expect(correr(EDICION, ['UPDATE_USER', 'READ_ORGANISM'], [UserRole.SUPERADMIN])).toBeTrue();

    TestBed.resetTestingModule();
    const agente = correr(EDICION, ['UPDATE_USER', 'READ_ORGANISM'], [UserRole.AGENT]);
    expect((agente as UrlTree).toString()).toBe('/dashboard/usuarios/lista');

    TestBed.resetTestingModule();
    const sinLeerOrganismos = correr(EDICION, ['UPDATE_USER'], [UserRole.SUPERADMIN]);
    expect((sinLeerOrganismos as UrlTree).toString()).toBe('/dashboard/usuarios/lista');
  });

  it('sin pedido de diálogo la lista pasa sin más', () => {
    expect(correr('/dashboard/usuarios/lista', ['READ_USER'], [UserRole.AGENT])).toBeTrue();
  });
});
