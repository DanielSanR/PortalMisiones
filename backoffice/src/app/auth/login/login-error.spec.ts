import { HttpErrorResponse } from '@angular/common/http';
import { NoBackofficeAccessError } from '@core/errors/no-backoffice-access.error';
import {
  LOGIN_CREDENCIALES, LOGIN_CUENTA_BLOQUEADA, LOGIN_CUENTA_DESBLOQUEADA, LOGIN_CUENTA_ELIMINADA, LOGIN_CUENTA_INACTIVA, LOGIN_INESPERADO, LOGIN_SERVIDOR_CAIDO, LOGIN_SIN_CONEXION, mensajeErrorLogin,
} from './login-error';

describe('mensajeErrorLogin', () => {
  const http = (status: number, error: unknown = null) =>
    new HttpErrorResponse({ status, error, url: '/api/auth/login' });

  it('status 0 (red caída, CORS, puerto ocupado) no culpa a las credenciales', () => {
    expect(mensajeErrorLogin(http(0))).toBe(LOGIN_SIN_CONEXION);
  });

  it('5xx avisa que el servidor no está disponible', () => {
    expect(mensajeErrorLogin(http(503))).toBe(LOGIN_SERVIDOR_CAIDO);
    expect(mensajeErrorLogin(http(500, { code: 5000, message: 'Ocurrió un error inesperado.' }))).toBe(LOGIN_SERVIDOR_CAIDO);
  });

  it('contraseña incorrecta y usuario inexistente comparten texto propio (no se revela qué emails tienen cuenta)', () => {
    expect(mensajeErrorLogin(http(401, { code: 4016, message: 'La contraseña ingresada es incorrecta.' }))).toBe(LOGIN_CREDENCIALES);
    expect(mensajeErrorLogin(http(404, { code: 4023, message: 'Usuario no encontrado.' }))).toBe(LOGIN_CREDENCIALES);
  });

  it('cuenta inactiva o dada de baja: texto propio según el código, nunca el mensaje del backend', () => {
    expect(mensajeErrorLogin(http(401, { code: 4001, message: 'Account is not active' }))).toBe(LOGIN_CUENTA_INACTIVA);
    expect(mensajeErrorLogin(http(401, { code: 4030, message: 'Account deleted' }))).toBe(LOGIN_CUENTA_ELIMINADA);
  });

  it('4030 no afirma que la cuenta fue eliminada: el backend lo usa también para las desactivadas por un administrador', () => {
    const texto = mensajeErrorLogin(http(401, { code: 4030, message: 'Cuenta eliminada.' }));
    expect(texto).toBe('Esta cuenta está desactivada o dada de baja. Si creés que es un error, consultá con un administrador.');
    expect(texto).not.toContain('eliminada');
    expect(texto).not.toContain('fue dada de baja');
  });

  describe('cuenta bloqueada por intentos fallidos (401 con 4015 / 4014 / 4013)', () => {
    const BLOQUEADA = 'Tu cuenta está bloqueada por varios intentos fallidos. Esperá un momento antes de volver a intentar: '
      + 'mientras dure el bloqueo no vas a poder entrar aunque la contraseña sea correcta.';

    it('4015 (este intento la bloqueó): dice que está bloqueada y que hay que esperar, no culpa a la contraseña', () => {
      const texto = mensajeErrorLogin(http(401, { code: 4015, message: 'La cuenta está bloqueada porque excedió el número máximo de intentos.' }));
      expect(texto).toBe(BLOQUEADA);
      expect(texto).toBe(LOGIN_CUENTA_BLOQUEADA);
      expect(texto).not.toBe(LOGIN_CREDENCIALES);
      expect(texto).not.toContain('no son correctos');
    });

    it('4014 (sigue bloqueada): mismo texto, sin copiar los minutos que el backend manda dentro del message', () => {
      const texto = mensajeErrorLogin(http(401, {
        code: 4014, message: 'Excedió el número de intentos, inténtelo de nuevo más tarde. Tiempo restante: 37 minutos.',
      }));
      expect(texto).toBe(BLOQUEADA);
      expect(texto).not.toContain('37');
      expect(texto).not.toContain('Tiempo restante');
      expect(texto).not.toContain('inténtelo');
    });

    it('4013 (el bloqueo venció y este intento la desbloqueó): pide volver a intentar', () => {
      const texto = mensajeErrorLogin(http(401, { code: 4013, message: 'Su cuenta ha sido desbloqueada. Inicie sesión nuevamente' }));
      expect(texto).toBe('Tu cuenta se desbloqueó. Volvé a intentar.');
      expect(texto).toBe(LOGIN_CUENTA_DESBLOQUEADA);
      expect(texto).not.toBe(LOGIN_CREDENCIALES);
    });
  });

  it('un 4xx que no se reconoce no muestra el mensaje del backend', () => {
    expect(mensajeErrorLogin(http(429, { code: 4999, message: 'Too many requests from 10.0.0.3' }))).toBe(LOGIN_INESPERADO);
  });

  it('401 sin mensaje cae en credenciales', () => {
    expect(mensajeErrorLogin(http(401))).toBe(LOGIN_CREDENCIALES);
  });

  it('sin acceso al backoffice muestra su propio mensaje', () => {
    const err = new NoBackofficeAccessError();
    expect(mensajeErrorLogin(err)).toBe(err.message);
  });

  it('un error desconocido no inventa una causa', () => {
    expect(mensajeErrorLogin(new Error('x'))).toBe(LOGIN_INESPERADO);
  });
});
