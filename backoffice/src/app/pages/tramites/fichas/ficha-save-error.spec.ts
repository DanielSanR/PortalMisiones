import { FormControl, FormGroup } from '@angular/forms';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { CONFLICTOS_FICHA, FALLBACK_FICHA, TEXTO_5000_GUARDADO, mensajeErrorAccion } from './ficha-save-error';

/** Error con la forma de un `HttpErrorResponse` del backend. */
function error(code: number, status?: number): unknown {
  return { status, error: { code, message: 'Ocurrió un error inesperado. Contacte al administrador.' } };
}

describe('errores de guardado de la ficha', () => {
  let form: FormGroup;

  beforeEach(() => {
    form = new FormGroup({ slug: new FormControl('obtener-licencia-posadas') });
  });

  it('el 5000 del alta/edición sugiere el duplicado posible, no el texto genérico del backend', () => {
    const texto = aplicarErrorDeGuardado(error(5000, 500), form, CONFLICTOS_FICHA, FALLBACK_FICHA);
    expect(texto).toBe(TEXTO_5000_GUARDADO);
    expect(texto).toContain('ya tenga una ficha');
    expect(texto).toContain('desactivada');
    expect(texto).toContain('slug');
    // Sigue cubriendo las otras causas del 500 genérico.
    expect(texto).toContain('recargá');
    // No se sabe cuál de los dos duplicados fue: no se marca ningún campo.
    expect(form.controls['slug'].errors).toBeNull();
  });

  it('un 4072 (si el backend lo llega a mandar) marca el slug', () => {
    aplicarErrorDeGuardado(error(4072, 409), form, CONFLICTOS_FICHA, FALLBACK_FICHA);
    expect(form.controls['slug'].errors).toEqual({ server: 'Ya hay otra ficha con ese slug. Elegí otro.' });
  });

  it('el 5000 de una acción (workflow, desactivar) no habla de duplicados', () => {
    const texto = mensajeErrorAccion(error(5000, 500));
    expect(texto).toContain('cambiado de estado');
    expect(texto).not.toContain('slug');
  });
});
