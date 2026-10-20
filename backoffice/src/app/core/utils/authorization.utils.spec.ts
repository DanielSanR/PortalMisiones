import { UserRole } from '../enums/user-role.enum';
import { CREAR_ETIQUETA_ACCESS } from '../constants/policy-overrides.constants';
import { AuthzContext, canPerform, evaluateAccess } from './authorization.utils';

function ctx(roles: UserRole[], permissions: string[]): AuthzContext {
  return { roles, permissions };
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

describe('canPerform', () => {
  it('aplica PERMISSION_PREREQUISITES (CREATE_USER exige READ_ORGANISM y rol admin)', () => {
    expect(canPerform(ctx([UserRole.SUPERADMIN], ['CREATE_USER']), 'CREATE_USER')).toBeFalse();
    expect(canPerform(ctx([UserRole.SUPERADMIN], ['CREATE_USER', 'READ_ORGANISM']), 'CREATE_USER')).toBeTrue();
    expect(canPerform(ctx([UserRole.AGENT], ['CREATE_USER', 'READ_ORGANISM']), 'CREATE_USER')).toBeFalse();
  });
});
