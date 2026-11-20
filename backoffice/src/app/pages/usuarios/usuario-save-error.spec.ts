import { FormControl, FormGroup } from '@angular/forms';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { CONFLICTOS_ALTA_USUARIO, FALLBACK_USUARIO, conflictosDeAltaUsuario } from './usuario-save-error';

/** 404 de algo ELEGIDO en un selector del alta: no puede leerse como "el registro ya no existe". */
describe('alta de usuario: lo elegido en un selector ya no existe', () => {
  let form: FormGroup;
  const alta = (code: number, message: string, f: FormGroup | undefined = form): string =>
    aplicarErrorDeGuardado({ status: 404, error: { code, message } }, f, CONFLICTOS_ALTA_USUARIO, FALLBACK_USUARIO);

  beforeEach(() => {
    form = new FormGroup({ email: new FormControl('a@b.com'), rol: new FormControl('r1'), organismoId: new FormControl('o1') });
  });

  it('4058: el organismo elegido ya no existe, marcado en el organismo', () => {
    expect(alta(4058, 'Organización no encontrada.')).toBe('Revisá el campo marcado.');
    expect(form.controls['organismoId'].getError('server')).toBe('Ese organismo ya no existe. Elegí otro.');
    expect(form.controls['rol'].errors).toBeNull();
  });

  it('4058 sin el campo en pantalla (rol global): el mismo texto va al banner', () => {
    form.removeControl('organismoId');
    expect(alta(4058, 'Organización no encontrada.')).toBe('Ese organismo ya no existe. Elegí otro.');
  });

  it('4058 con el organismo fijo de la sesión (campo de solo lectura): va al banner y no deja el form inválido', () => {
    const texto = aplicarErrorDeGuardado(
      { status: 404, error: { code: 4058, message: 'Organización no encontrada.' } }, form, conflictosDeAltaUsuario(true), FALLBACK_USUARIO,
    );
    expect(texto).toContain('El organismo de tu cuenta ya no existe');
    expect(texto).not.toContain('Elegí otro');
    expect(form.controls['organismoId'].errors).toBeNull();
    expect(form.valid).toBeTrue();
  });

  it('sin organismo fijo, los conflictos del alta son los de siempre', () => {
    expect(conflictosDeAltaUsuario(false)).toBe(CONFLICTOS_ALTA_USUARIO);
  });

  it('4018: el rol elegido ya no existe; nunca el message real ("Las contraseñas no coinciden")', () => {
    expect(alta(4018, 'Las contraseñas no coinciden.')).toBe('Revisá el campo marcado.');
    expect(form.controls['rol'].getError('server')).toBe('Ese rol ya no existe o no se puede asignar. Elegí otro.');
  });
});
