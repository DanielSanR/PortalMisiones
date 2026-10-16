import { HttpErrorResponse } from '@angular/common/http';
import { NoBackofficeAccessError } from '../../core/errors/no-backoffice-access.error';
import {
  LOGIN_CREDENCIALES, LOGIN_INESPERADO, LOGIN_SERVIDOR_CAIDO, LOGIN_SIN_CONEXION, mensajeErrorLogin,
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

  it('4xx usa el mensaje de negocio del backend', () => {
    expect(mensajeErrorLogin(http(401, { code: 4016, message: 'La contraseña ingresada es incorrecta.' })))
      .toBe('La contraseña ingresada es incorrecta.');
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
