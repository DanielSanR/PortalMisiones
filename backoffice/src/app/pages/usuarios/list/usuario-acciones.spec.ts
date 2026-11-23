import { UserRole } from '@core/enums/user-role.enum';
import { confirmacionDeEstado, mensajeDeEliminar, ofreceCambioDePassword } from './usuario-acciones';

describe('usuario-acciones', () => {
  describe('ofreceCambioDePassword', () => {
    it('no se ofrece para Super Administrador ni Administrador de Backoffice (el backend lo rechaza)', () => {
      expect(ofreceCambioDePassword(UserRole.SUPERADMIN)).toBeFalse();
      expect(ofreceCambioDePassword(UserRole.ADMIN_BACKOFFICE)).toBeFalse();
    });

    it('se ofrece para el resto, y también con el rol desconocido', () => {
      expect(ofreceCambioDePassword(UserRole.AGENT)).toBeTrue();
      expect(ofreceCambioDePassword(null)).toBeTrue();
      expect(ofreceCambioDePassword(undefined)).toBeTrue();
    });
  });

  describe('confirmacionDeEstado', () => {
    it('desactivar: es destructiva y aclara que la cuenta se conserva', () => {
      const textos = confirmacionDeEstado('Ana Paz', false);
      expect(textos).toEqual({
        title: '¿Desactivar la cuenta?',
        message: 'Ana Paz dejará de poder ingresar al backoffice. La cuenta se conserva y podés volver a activarla cuando quieras.',
        danger: true,
        confirmText: 'Sí, desactivar',
        busyText: 'Desactivando…',
        exito: 'Cuenta desactivada',
      });
    });

    it('activar: no es destructiva y dice con qué permisos vuelve', () => {
      const textos = confirmacionDeEstado('Ana Paz', true);
      expect(textos.title).toBe('¿Activar la cuenta?');
      expect(textos.message).toBe('Ana Paz volverá a poder ingresar al backoffice con los permisos de su rol.');
      expect(textos.danger).toBeFalse();
      expect([textos.confirmText, textos.busyText, textos.exito]).toEqual(['Sí, activar', 'Activando…', 'Cuenta activada']);
    });
  });

  it('eliminar avisa que no se puede deshacer y ofrece desactivar en su lugar', () => {
    expect(mensajeDeEliminar('Ana Paz')).toBe(
      'Se borrará Ana Paz con todos sus datos y no se puede deshacer. Si solo querés quitarle el acceso, desactivá la cuenta.',
    );
  });
});
