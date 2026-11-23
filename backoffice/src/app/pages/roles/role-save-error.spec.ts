import { API_CODES } from '@core/constants/api-codes.constants';
import { errorDeActivarRol } from './role-save-error';

const rechazo = (code: number, status: number) => ({ status, error: { code, message: 'texto del backend' } });

describe('errorDeActivarRol', () => {
  it('cada rechazo de negocio del PUT tiene su texto propio, nunca el del backend', () => {
    expect(errorDeActivarRol(rechazo(API_CODES.ROLE_NOT_FOUND, 404)))
      .toBe('Ese rol ya no existe. Recargá la página para ver la lista actualizada.');
    expect(errorDeActivarRol(rechazo(API_CODES.ROLE_ALREADY_EXISTS, 409))).toContain('otro rol ya usa ese código');
    expect(errorDeActivarRol(rechazo(API_CODES.NO_PERMISSION, 403))).toContain('Solo un Super Administrador');
  });

  it('un error sin código previsto devuelve `null`: la confirmación usa el texto compartido', () => {
    expect(errorDeActivarRol({ status: 0, error: null })).toBeNull();
    expect(errorDeActivarRol(rechazo(9999, 400))).toBeNull();
  });
});
