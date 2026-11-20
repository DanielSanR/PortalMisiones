import { HttpErrorResponse } from '@angular/common/http';
import { TEXTOS_DE_ERROR_HTTP } from '../utils/http-error-text.utils';
import { ERROR_INESPERADO, dialogoDeErrorHttp } from './http-error.service';

const CRUDO = 'Unexpected error: org.hibernate.StaleObjectStateException';
const http = (status: number, code?: number): HttpErrorResponse =>
  new HttpErrorResponse({ status, error: { code, message: CRUDO } });

describe('dialogoDeErrorHttp (diálogo global de error)', () => {
  const CASOS: [number, string, string][] = [
    [0, 'Sin conexión', TEXTOS_DE_ERROR_HTTP['sin-conexion'].accion],
    [403, 'Acceso denegado', TEXTOS_DE_ERROR_HTTP['sin-permiso'].accion],
    [404, 'No encontrado', TEXTOS_DE_ERROR_HTTP.inexistente.accion],
    [409, 'Conflicto', TEXTOS_DE_ERROR_HTTP.conflicto.accion],
    [400, 'Datos no aceptados', TEXTOS_DE_ERROR_HTTP['datos-rechazados'].accion],
    [500, 'Error del servidor', TEXTOS_DE_ERROR_HTTP.servidor.accion],
    [418, 'Error', ERROR_INESPERADO],
  ];

  CASOS.forEach(([status, title, message]) => {
    it(`HTTP ${status}: "${title}" con texto propio`, () => {
      expect(dialogoDeErrorHttp(http(status, 4999))).toEqual({ title, message });
    });
  });

  it('4034: dice la política de contraseñas', () => {
    const { title, message } = dialogoDeErrorHttp(http(400, 4034));
    expect(title).toBe('Contraseña débil');
    expect(message).toContain('entre 8 y 20 caracteres');
  });

  it('nunca muestra el message del backend', () => {
    [0, 400, 403, 404, 406, 409, 418, 500].forEach((status) => {
      expect(dialogoDeErrorHttp(http(status, 4002)).message).not.toContain('hibernate');
    });
  });
});
