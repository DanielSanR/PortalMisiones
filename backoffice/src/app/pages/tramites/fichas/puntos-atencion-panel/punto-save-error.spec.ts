import { firstValueFrom, throwError } from 'rxjs';
import { FormControl, FormGroup } from '@angular/forms';
import {
  CONFLICTOS_PUNTO, FALLBACK_PUNTO, TEXTO_PUNTO_ERROR_SERVIDOR, TEXTO_PUNTO_SIN_PERMISO, conMensajeDePunto, puntoErrorGuardado,
} from './punto-save-error';

/** Lo que el backend manda en `message`: nunca tiene que llegar a la pantalla. */
const CRUDO = 'El objeto AttentionPoint con el identificador 3f2c8a10 no existe. / Unexpected error';

function error(status: number | undefined, code?: number): unknown {
  return { status, error: { code, message: CRUDO } };
}

describe('puntoErrorGuardado: siempre un texto propio, nunca el message del backend', () => {
  let form: FormGroup;

  beforeEach(() => {
    form = new FormGroup({ nombre: new FormControl('Oficina central') });
  });

  const textoDe = (code: number): string => CONFLICTOS_PUNTO.find((c) => c.code === code)!.mensaje;

  it('403 (con o sin el código 4029): sin permiso', () => {
    expect(puntoErrorGuardado(error(403, 403), form)).toBe(TEXTO_PUNTO_SIN_PERMISO);
    expect(puntoErrorGuardado(error(403, 4029), form)).toBe(TEXTO_PUNTO_SIN_PERMISO);
  });

  it('5xx o 5000: error del servidor, no de lo que se cargó', () => {
    expect(puntoErrorGuardado(error(500, 5000), form)).toBe(TEXTO_PUNTO_ERROR_SERVIDOR);
    expect(puntoErrorGuardado(error(502), form)).toBe(TEXTO_PUNTO_ERROR_SERVIDOR);
    expect(puntoErrorGuardado(error(500, 5001), form)).toBe(TEXTO_PUNTO_ERROR_SERVIDOR);
  });

  it('4012: remite a los campos obligatorios y a los rangos de las coordenadas', () => {
    expect(puntoErrorGuardado(error(400, 4012), form)).toBe(textoDe(4012));
  });

  it('404 (con 4073 o sin código): la ficha o el punto ya no existe', () => {
    expect(puntoErrorGuardado(error(404, 4073), form)).toBe(textoDe(4073));
    expect(puntoErrorGuardado(error(404), form)).toBe(textoDe(4073));
  });

  it('cualquier otra cosa (código desconocido, sin conexión, error raro): el texto genérico propio', () => {
    expect(puntoErrorGuardado(error(409, 4999), form)).toBe(FALLBACK_PUNTO);
    expect(puntoErrorGuardado({ status: 0, error: null }, form)).toBe(FALLBACK_PUNTO);
    expect(puntoErrorGuardado(new Error(CRUDO), form)).toBe(FALLBACK_PUNTO);
  });

  it('en ningún caso devuelve el message del backend', () => {
    for (const err of [error(403, 403), error(500, 5000), error(400, 4012), error(404, 4073), error(409, 4999), error(400), error(undefined)]) {
      expect(puntoErrorGuardado(err, form)).not.toContain('AttentionPoint');
    }
  });
});

describe('conMensajeDePunto (confirmación de "Desactivar")', () => {
  it('traduce el error a un texto propio para el diálogo de confirmación', async () => {
    const err = await firstValueFrom(conMensajeDePunto(throwError(() => error(404, 4073)))).catch((e: unknown) => e);
    expect((err as { error: { message: string } }).error.message).toBe('El punto de atención ya no existe o quedó fuera de tu alcance.');
  });
});
