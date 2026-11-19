import { FormControl, FormGroup } from '@angular/forms';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { CONFLICTOS_ASIGNACION_ROL, FALLBACK_ASIGNACION_ROL } from './usuario-rol-save-error';

/** Error con la forma de un `HttpErrorResponse` del backend. */
const error = (code: number, message: string): unknown => ({ error: { code, message } });

describe('errores de la asignación de rol', () => {
  let form: FormGroup;

  const traducir = (code: number, message = 'texto del backend'): string =>
    aplicarErrorDeGuardado(error(code, message), form, CONFLICTOS_ASIGNACION_ROL, FALLBACK_ASIGNACION_ROL);

  beforeEach(() => {
    form = new FormGroup({
      email: new FormControl('ana@misiones.gob.ar'),
      rolId: new FormControl('rol-uuid'),
      organismoId: new FormControl('org-uuid'),
      vigenteDesde: new FormControl('2026-12-01'),
      vigenteHasta: new FormControl('2026-11-01'),
    });
  });

  it('4081: el período se superpone, va al banner sin marcar campos', () => {
    expect(traducir(4081)).toContain('ya tiene un rol asignado en ese período');
    expect(form.valid).toBeTrue();
  });

  it('4011: marca el fin de la vigencia', () => {
    expect(traducir(4011)).toBe('Revisá el campo marcado.');
    expect(form.controls['vigenteHasta'].errors).toEqual({ server: 'Tiene que ser posterior al inicio de la vigencia' });
  });

  it('4058: marca el organismo', () => {
    traducir(4058);
    expect(form.controls['organismoId'].errors).toEqual({ server: 'Ese organismo ya no existe. Elegí otro.' });
  });

  it('4018: marca el rol y no muestra "Las contraseñas no coinciden"', () => {
    const texto = traducir(4018, 'Las contraseñas no coinciden.');
    expect(texto).not.toContain('contraseñas');
    expect(form.controls['rolId'].errors).toEqual({ server: 'Ese rol ya no existe. Elegí otro.' });
  });

  it('4029: explica la regla de rol y organismo en el banner', () => {
    const texto = traducir(4029, 'El usuario no tiene permisos para realizar esta acción.');
    expect(texto).toContain('un rol global no lleva organismo');
    // PPDT-5.1: un Administrador de Backoffice solo asigna roles `assignableByBackoffice`.
    expect(texto).toContain('solo los asigna un Super Administrador');
    expect(texto).not.toContain('El usuario no tiene permisos');
    expect(form.valid).toBeTrue();
  });

  it('4002: acá es "usuario inactivo"; no muestra el texto del backend ni marca el email', () => {
    const texto = traducir(4002, 'El usuario ya está registrado. Por favor, intente con otro email/cuit.');
    expect(texto).toBe('El usuario está inactivo. Activá la cuenta antes de asignarle un rol.');
    expect(form.controls['email'].errors).toBeNull();
  });

  it('4019: el usuario ya no existe, sin invitar a registrarse', () => {
    expect(traducir(4019, 'El usuario no está registrado. Por favor regístrese.')).toBe('El usuario ya no existe. Recargá el listado.');
  });

  it('sin el control en el form, el texto del campo va al banner', () => {
    form.removeControl('vigenteHasta');
    expect(traducir(4011)).toBe('Tiene que ser posterior al inicio de la vigencia');
  });

  it('un error sin código de negocio cae en el fallback', () => {
    expect(aplicarErrorDeGuardado({ error: null }, form, CONFLICTOS_ASIGNACION_ROL, FALLBACK_ASIGNACION_ROL))
      .toBe(FALLBACK_ASIGNACION_ROL);
  });
});
