import { FormControl, FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { API_CODES } from '@core/constants/api-codes.constants';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { CONFLICTOS_CATEGORIA, FALLBACK_CATEGORIA, errorDeEliminarCategoria } from './categoria-save-error';

const error = (status: number, code: number, message = 'x'): unknown => ({ status, error: { code, message } });

describe('eliminar una categoría: errorDeEliminarCategoria', () => {
  const CRUDO = 'No se puede eliminar la categoría porque tiene subcategorías asociadas.';

  it('4065 (400, tiene subcategorías): dice el motivo y qué hacer, no manda a recargar ni a revisar un formulario', () => {
    const texto = errorDeEliminarCategoria(error(400, 4065, CRUDO));
    expect(texto).toBe('No se puede eliminar: tiene subcategorías. Movelas a otra categoría padre o eliminalas primero.');
    expect(texto).not.toContain('Recargá');
    expect(texto).not.toContain('formulario');
    expect(texto).not.toContain(CRUDO);
  });

  it('cualquier otro error devuelve null (sigue el texto compartido de la confirmación)', () => {
    // Incluye el 500 `5000` de una categoría en uso por una plantilla: el backend no le da código propio.
    [error(404, 4073), error(400, 4012), error(500, 5000), { status: 0, error: null }]
      .forEach((err) => expect(errorDeEliminarCategoria(err)).toBeNull());
  });
});

describe('guardado de categoría: padre inválido', () => {
  let form: FormGroup;

  beforeEach(() => {
    form = new FormGroup({ slug: new FormControl('salud'), parentId: new FormControl('edu') });
  });

  it('4074 (400): se eligió a sí misma como padre', () => {
    expect(aplicarErrorDeGuardado(error(400, 4074), form, CONFLICTOS_CATEGORIA, FALLBACK_CATEGORIA)).toBe('Revisá el campo marcado.');
    expect(form.controls['parentId'].getError('server')).toBe('Una categoría no puede ser su propia categoría padre. Elegí otra.');
  });

  it('4075 (400): se eligió como padre a una de sus subcategorías', () => {
    aplicarErrorDeGuardado(error(400, 4075), form, CONFLICTOS_CATEGORIA, FALLBACK_CATEGORIA);
    expect(form.controls['parentId'].getError('server')).toBe('Esa categoría es una subcategoría de esta: no puede ser su padre. Elegí otra.');
    expect(form.controls['slug'].errors).toBeNull();
  });
});

/** `HttpErrorResponse` real, como lo entrega `HttpClient`. */
function respuesta(status: number, code: number, message = 'El objeto X con el identificador y existe.'): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code, message } });
}

/**
 * Duplicados: el backend `586b670` responde HTTP 409 con el mismo código `4072` que antes viajaba con 400.
 * El front decide por CÓDIGO: el resultado tiene que ser idéntico con cualquiera de los dos status.
 */
describe('aplicarErrorDeGuardado — categoría: duplicado 4072 con 409 (antes 400)', () => {
  [409, 400].forEach((status) => {
    it(`categoría: HTTP ${status} + 4072 marca "slug" con texto propio`, () => {
      const form = new FormGroup({ slug: new FormControl('repetido') });

      const texto = aplicarErrorDeGuardado(respuesta(status, API_CODES.ENTITY_CONFLICT), form, CONFLICTOS_CATEGORIA, 'fallback');

      expect(texto).toBe('Revisá el campo marcado.');
      const server = form.get('slug')?.getError('server') as string;
      expect(server).toBeTruthy();
      // Nunca el `message` crudo del backend cuando hay texto propio.
      expect(server).not.toContain('El objeto X');
      expect(form.get('slug')?.touched).toBeTrue();
    });
  });

  it('categoría: el formulario tiene unicidad y declara el 4072', () => {
    expect(CONFLICTOS_CATEGORIA.some((c) => c.code === 4072)).toBeTrue();
  });
});
