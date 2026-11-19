import { UserRole } from '@core/enums/user-role.enum';
import { AccionDeCuenta, errorDeAccionDeCuenta, esAccionDenegada, mensajeDeAccionDenegada } from './usuario-accion-error';

/** 403 `4029` con el `message` real de `messages.properties`. */
const DENEGADO = { status: 403, error: { code: 4029, message: 'El usuario no tiene permisos para realizar esta acción.' } };
const ACCIONES: AccionDeCuenta[] = ['email', 'password', 'activar', 'desactivar', 'eliminar'];

describe('acciones de cuenta rechazadas con 403 4029 (PPDT-5.1)', () => {
  it('reconoce el 4029 por código, no por status', () => {
    expect(esAccionDenegada(DENEGADO)).toBeTrue();
    expect(esAccionDenegada({ error: { code: 4029 } })).toBeTrue();
    expect(esAccionDenegada({ status: 403, error: { code: 403, message: 'Access Denied' } })).toBeFalse();
    expect(esAccionDenegada(new Error('x'))).toBeFalse();
    expect(esAccionDenegada(null)).toBeFalse();
  });

  it('nunca muestra el `message` crudo del backend, en ninguna acción ni rol', () => {
    for (const accion of ACCIONES) {
      for (const rol of [UserRole.ADMIN_BACKOFFICE, UserRole.ADMIN_ORGANIZATION, UserRole.SUPERADMIN, null]) {
        const texto = errorDeAccionDeCuenta(DENEGADO, accion, rol);
        expect(texto).toBeTruthy();
        expect(texto).not.toContain(DENEGADO.error.message);
        expect(texto).toMatch(/^No podés /);
      }
    }
  });

  it('Administrador de Backoffice: la cuenta es privilegiada y solo la gestiona un Super Administrador', () => {
    const rol = UserRole.ADMIN_BACKOFFICE;
    expect(mensajeDeAccionDenegada('eliminar', rol)).toBe(
      'No podés eliminar esta cuenta: es de un Super Administrador o de un Administrador de Backoffice, y solo un Super Administrador puede gestionarlas.');
    expect(mensajeDeAccionDenegada('activar', rol)).toContain('No podés activar esta cuenta: es de un Super Administrador');
    expect(mensajeDeAccionDenegada('desactivar', rol)).toContain('No podés desactivar esta cuenta: es de un Super Administrador');
    expect(mensajeDeAccionDenegada('email', rol)).toContain('No podés cambiar el email de esta cuenta: es de un Super Administrador');
  });

  it('contraseña: el motivo es la cuenta privilegiada, opere quien opere', () => {
    for (const rol of [UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE, UserRole.ADMIN_ORGANIZATION, null]) {
      expect(mensajeDeAccionDenegada('password', rol)).toBe(
        'No podés cambiar la contraseña de esta cuenta: es de un Super Administrador o de un Administrador de Backoffice, y su contraseña no se cambia desde el panel.');
    }
  });

  it('Administrador de Organismo: solo las de su organismo, y no elimina ninguna', () => {
    const rol = UserRole.ADMIN_ORGANIZATION;
    expect(mensajeDeAccionDenegada('desactivar', rol)).toBe('No podés desactivar esta cuenta: solo podés gestionar las cuentas de tu organismo.');
    expect(mensajeDeAccionDenegada('eliminar', rol)).toContain('un Administrador de Organismo no elimina usuarios');
  });

  it('otro rol (o ninguno canónico): texto genérico propio', () => {
    expect(mensajeDeAccionDenegada('email', null)).toBe('No podés cambiar el email de esta cuenta: tu rol no permite gestionar cuentas de otros usuarios.');
  });

  it('otro error no se traduce: la pantalla sigue con su manejo habitual', () => {
    expect(errorDeAccionDeCuenta({ status: 404, error: { code: 4019, message: 'No registrado' } }, 'email', UserRole.ADMIN_BACKOFFICE)).toBeNull();
    expect(errorDeAccionDeCuenta(new Error('sin conexión'), 'eliminar', null)).toBeNull();
  });
});
