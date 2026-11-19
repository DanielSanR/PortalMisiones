import { UserRole } from '../enums/user-role.enum';
import { ADOPTAR_ACCESS, CREAR_ETIQUETA_ACCESS, EDITAR_USUARIO_ACCESS } from '../constants/policy-overrides.constants';
import { AuthUser } from '../models/auth.model';
import { AuthzContext, authzContextDe, canPerform, evaluateAccess } from './authorization.utils';

function ctx(roles: UserRole[], permissions: string[], organismoPropio = false): AuthzContext {
  return { roles, permissions, organismoPropio };
}

describe('evaluateAccess', () => {
  it('sin regla permite', () => {
    expect(evaluateAccess(ctx([], []), undefined)).toBeTrue();
  });

  it('anyOf exige al menos una alternativa, además de los permisos y roles de la regla', () => {
    const regla = { permissions: ['A'], anyOf: [{ permissions: ['B'] }, { requireRoles: [UserRole.SUPERADMIN] }] };
    expect(evaluateAccess(ctx([], ['A', 'B']), regla)).toBeTrue();
    expect(evaluateAccess(ctx([UserRole.SUPERADMIN], ['A']), regla)).toBeTrue();
    expect(evaluateAccess(ctx([UserRole.AGENT], ['A']), regla)).toBeFalse();
    expect(evaluateAccess(ctx([UserRole.SUPERADMIN], ['B']), regla)).toBeFalse();
  });

  it('anyOf vacío no agrega condición', () => {
    expect(evaluateAccess(ctx([], ['A']), { permissions: ['A'], anyOf: [] })).toBeTrue();
  });
});

describe('CREAR_ETIQUETA_ACCESS (BO-20)', () => {
  const puede = (roles: UserRole[], permissions: string[]) => evaluateAccess(ctx(roles, permissions), CREAR_ETIQUETA_ACCESS);

  it('SA y AB pueden crear (globales) aunque no tengan READ_ORGANISM', () => {
    expect(puede([UserRole.SUPERADMIN], ['CREATE_TAG'])).toBeTrue();
    expect(puede([UserRole.ADMIN_BACKOFFICE], ['CREATE_TAG'])).toBeTrue();
  });

  it('AO y AGENT sin READ_ORGANISM no pueden: no tienen ningún alcance válido para elegir', () => {
    expect(puede([UserRole.ADMIN_ORGANIZATION], ['CREATE_TAG', 'READ_TAG'])).toBeFalse();
    expect(puede([UserRole.AGENT], ['CREATE_TAG', 'READ_TAG'])).toBeFalse();
  });

  it('con READ_ORGANISM cualquiera con CREATE_TAG puede (elige el organismo en el select)', () => {
    expect(puede([UserRole.ADMIN_ORGANIZATION], ['CREATE_TAG', 'READ_ORGANISM'])).toBeTrue();
  });

  it('sin CREATE_TAG nadie puede', () => {
    expect(puede([UserRole.SUPERADMIN], ['READ_TAG', 'READ_ORGANISM'])).toBeFalse();
  });
});

describe('organismo en la sesión (G-2, backend 586b670)', () => {
  const AO = [UserRole.ADMIN_ORGANIZATION];

  it('`organismoPropio` solo se cumple si la sesión está atada a un organismo', () => {
    expect(evaluateAccess(ctx([], [], true), { organismoPropio: true })).toBeTrue();
    expect(evaluateAccess(ctx([], [], false), { organismoPropio: true })).toBeFalse();
    // Contexto armado a mano sin el dato (código viejo): se toma como "sin organismo".
    expect(evaluateAccess({ roles: [], permissions: [] }, { organismoPropio: true })).toBeFalse();
  });

  it('authzContextDe: solo una sesión de organismo con id conocido tiene organismo propio', () => {
    const base = { permissions: ['A'], roles: AO } as AuthUser;
    expect(authzContextDe({ ...base, scope: 'organismo', organismoId: 'org-1' }).organismoPropio).toBeTrue();
    expect(authzContextDe({ ...base, scope: 'global', organismoId: null }).organismoPropio).toBeFalse();
    expect(authzContextDe(base).organismoPropio).toBeFalse(); // backend anterior: sin scope ni organismo
    expect(authzContextDe(null)).toEqual({ permissions: [], roles: [], organismoPropio: false });
  });

  it('"Nueva etiqueta": AO/AGENT sin READ_ORGANISM pueden si traen su organismo en la sesión', () => {
    expect(evaluateAccess(ctx(AO, ['CREATE_TAG'], true), CREAR_ETIQUETA_ACCESS)).toBeTrue();
    expect(evaluateAccess(ctx([UserRole.AGENT], ['CREATE_TAG'], true), CREAR_ETIQUETA_ACCESS)).toBeTrue();
    expect(evaluateAccess(ctx(AO, ['READ_TAG'], true), CREAR_ETIQUETA_ACCESS)).toBeFalse();
  });

  it('"Adoptar trámite": hace falta READ_ORGANISM o el organismo de la sesión, además de CREATE_ADOPTION y READ_PROCEDURE', () => {
    const permisos = ['CREATE_ADOPTION', 'READ_PROCEDURE'];
    expect(evaluateAccess(ctx(AO, permisos, true), ADOPTAR_ACCESS)).toBeTrue();
    expect(evaluateAccess(ctx(AO, permisos, false), ADOPTAR_ACCESS)).toBeFalse();
    expect(evaluateAccess(ctx([UserRole.SUPERADMIN], [...permisos, 'READ_ORGANISM']), ADOPTAR_ACCESS)).toBeTrue();
    // Sin READ_PROCEDURE no hay plantillas que elegir, tenga o no organismo.
    expect(evaluateAccess(ctx(AO, ['CREATE_ADOPTION'], true), ADOPTAR_ACCESS)).toBeFalse();
  });

  it('alta de usuario: un AO con organismo en la sesión no necesita READ_ORGANISM; un rol global, sí', () => {
    expect(canPerform(ctx(AO, ['CREATE_USER'], true), 'CREATE_USER')).toBeTrue();
    expect(canPerform(ctx(AO, ['CREATE_USER'], false), 'CREATE_USER')).toBeFalse();
    expect(canPerform(ctx([UserRole.ADMIN_BACKOFFICE], ['CREATE_USER']), 'CREATE_USER')).toBeFalse();
    // El organismo no reemplaza al rol admin (`/api/role/allowed`).
    expect(canPerform(ctx([UserRole.AGENT], ['CREATE_USER'], true), 'CREATE_USER')).toBeFalse();
  });

  it('edición de usuario: misma alternativa que el alta', () => {
    expect(evaluateAccess(ctx(AO, ['UPDATE_USER'], true), EDITAR_USUARIO_ACCESS)).toBeTrue();
    expect(evaluateAccess(ctx(AO, ['UPDATE_USER'], false), EDITAR_USUARIO_ACCESS)).toBeFalse();
    expect(evaluateAccess(ctx([UserRole.SUPERADMIN], ['UPDATE_USER', 'READ_ORGANISM']), EDITAR_USUARIO_ACCESS)).toBeTrue();
    expect(evaluateAccess(ctx([UserRole.AGENT], ['UPDATE_USER', 'READ_ORGANISM']), EDITAR_USUARIO_ACCESS)).toBeFalse();
  });
});

describe('canPerform', () => {
  it('aplica PERMISSION_PREREQUISITES (sin organismo en la sesión, CREATE_USER exige READ_ORGANISM y rol admin)', () => {
    expect(canPerform(ctx([UserRole.SUPERADMIN], ['CREATE_USER']), 'CREATE_USER')).toBeFalse();
    expect(canPerform(ctx([UserRole.SUPERADMIN], ['CREATE_USER', 'READ_ORGANISM']), 'CREATE_USER')).toBeTrue();
    expect(canPerform(ctx([UserRole.AGENT], ['CREATE_USER', 'READ_ORGANISM']), 'CREATE_USER')).toBeFalse();
  });
});
