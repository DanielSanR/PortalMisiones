import { FormControl, FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { API_CODES } from '@core/constants/api-codes.constants';
import { TEXTOS_DE_ERROR_HTTP } from '@core/utils/http-error-text.utils';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { CONFLICTOS_PLANTILLA, FALLBACK_PLANTILLA } from './plantilla-save-error';

/** `HttpErrorResponse` real, como lo entrega `HttpClient`. */
function respuesta(status: number, code: number, message = 'El objeto X con el identificador y existe.'): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code, message } });
}

/**
 * Duplicados: el backend `586b670` responde HTTP 409 con el mismo código `4072` que antes viajaba con 400.
 * El front decide por CÓDIGO: el resultado tiene que ser idéntico con cualquiera de los dos status.
 */
describe('aplicarErrorDeGuardado — plantilla: duplicado 4072 con 409 (antes 400)', () => {
  [409, 400].forEach((status) => {
    it(`plantilla: HTTP ${status} + 4072 marca "slug" con texto propio`, () => {
      const form = new FormGroup({ slug: new FormControl('repetido') });

      const texto = aplicarErrorDeGuardado(respuesta(status, API_CODES.ENTITY_CONFLICT), form, CONFLICTOS_PLANTILLA, 'fallback');

      expect(texto).toBe('Revisá el campo marcado.');
      const server = form.get('slug')?.getError('server') as string;
      expect(server).toBeTruthy();
      // Nunca el `message` crudo del backend cuando hay texto propio.
      expect(server).not.toContain('El objeto X');
      expect(form.get('slug')?.touched).toBeTrue();
    });
  });

  it('plantilla: el formulario tiene unicidad y declara el 4072', () => {
    expect(CONFLICTOS_PLANTILLA.some((c) => c.code === 4072)).toBeTrue();
  });

  it('un 409 con otro código no se confunde con un duplicado: texto propio de conflicto, nunca el mensaje del backend', () => {
    const form = new FormGroup({ slug: new FormControl('x') });

    expect(aplicarErrorDeGuardado(respuesta(409, 4091, 'Otro usuario guardó antes.'), form, CONFLICTOS_PLANTILLA, FALLBACK_PLANTILLA))
      .toBe(TEXTOS_DE_ERROR_HTTP.conflicto.formulario);
    expect(form.controls.slug.errors).toBeNull();
  });
});
