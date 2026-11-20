import { FormControl, FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { API_CODES } from '@core/constants/api-codes.constants';
import { TEXTOS_DE_ERROR_HTTP } from '@core/utils/http-error-text.utils';
import { ConflictoDeCampo, aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { CONFLICTOS_CATEGORIA } from './categorias/categoria-save-error';
import { CONFLICTOS_ETIQUETA, FALLBACK_ETIQUETA } from './etiquetas/etiqueta-save-error';
import { CONFLICTOS_PLANTILLA, FALLBACK_PLANTILLA } from './tramites/plantillas/plantilla-save-error';

/** `HttpErrorResponse` real, como lo entrega `HttpClient`. */
function respuesta(status: number, code: number, message = 'El objeto X con el identificador y existe.'): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code, message } });
}

/**
 * Duplicados: el backend `586b670` responde HTTP 409 con el mismo código `4072` que antes viajaba con 400.
 * El front decide por CÓDIGO: el resultado tiene que ser idéntico con cualquiera de los dos status.
 */
describe('aplicarErrorDeGuardado — duplicado 4072 con 409 (antes 400)', () => {
  const FORMULARIOS: [nombre: string, conflictos: ConflictoDeCampo[], control: string][] = [
    ['plantilla', CONFLICTOS_PLANTILLA, 'slug'],
    ['etiqueta', CONFLICTOS_ETIQUETA, 'slug'],
    ['categoría', CONFLICTOS_CATEGORIA, 'slug'],
  ];

  FORMULARIOS.forEach(([nombre, conflictos, control]) => {
    [409, 400].forEach((status) => {
      it(`${nombre}: HTTP ${status} + 4072 marca "${control}" con texto propio`, () => {
        const form = new FormGroup({ [control]: new FormControl('repetido') });

        const texto = aplicarErrorDeGuardado(respuesta(status, API_CODES.ENTITY_CONFLICT), form, conflictos, 'fallback');

        expect(texto).toBe('Revisá el campo marcado.');
        const server = form.get(control)?.getError('server') as string;
        expect(server).toBeTruthy();
        // Nunca el `message` crudo del backend cuando hay texto propio.
        expect(server).not.toContain('El objeto X');
        expect(form.get(control)?.touched).toBeTrue();
      });
    });
  });

  it('todos los formularios con unicidad declaran el 4072', () => {
    FORMULARIOS.forEach(([, conflictos]) => {
      expect(conflictos.some((c) => c.code === 4072)).toBeTrue();
    });
  });

  it('un 409 con otro código no se confunde con un duplicado: texto propio de conflicto, nunca el mensaje del backend', () => {
    const form = new FormGroup({ slug: new FormControl('x') });

    expect(aplicarErrorDeGuardado(respuesta(409, 4091, 'Otro usuario guardó antes.'), form, CONFLICTOS_PLANTILLA, FALLBACK_PLANTILLA))
      .toBe(TEXTOS_DE_ERROR_HTTP.conflicto.formulario);
    expect(form.controls.slug.errors).toBeNull();
  });

  it('un 409 sin cuerpo también es un conflicto no declarado', () => {
    expect(aplicarErrorDeGuardado(new HttpErrorResponse({ status: 409 }), undefined, CONFLICTOS_ETIQUETA, FALLBACK_ETIQUETA))
      .toBe(TEXTOS_DE_ERROR_HTTP.conflicto.formulario);
  });
});
