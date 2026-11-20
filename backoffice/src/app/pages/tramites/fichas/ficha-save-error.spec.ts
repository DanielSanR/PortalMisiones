import { FormControl, FormGroup } from '@angular/forms';
import { FichaSinContenidoError } from '@features/fichas-locales';
import {
  FALLBACK_ACCION, FALLBACK_FICHA, TEXTO_EDICION_CONCURRENTE, TEXTO_FICHA_SIN_CONTENIDO, TEXTO_5000_GUARDADO, TEXTO_ADOPCION_NO_VIGENTE, TEXTO_FICHA_INEXISTENTE, TEXTO_LOCALIDAD_INEXISTENTE,
  entidadInexistente, mensajeErrorAccion, mensajeErrorGuardado,
} from './ficha-save-error';

/** Error con la forma de un `HttpErrorResponse` del backend. */
function error(code: number, status?: number, message = 'Ocurrió un error inesperado. Contacte al administrador.'): unknown {
  return { status, error: { code, message } };
}

/** 404 `4073` real del backend para una entidad (`messages.properties`). */
function noExiste(etiqueta: string): unknown {
  return error(4073, 404, `El objeto ${etiqueta} con el identificador 3f2c8a10-0000-4000-8000-000000000001 no existe.`);
}

describe('errores de guardado de la ficha', () => {
  let form: FormGroup;

  beforeEach(() => {
    form = new FormGroup({ slug: new FormControl('obtener-licencia-posadas') });
  });

  it('el 5000 del alta/edición sugiere el duplicado posible, no el texto genérico del backend', () => {
    const texto = mensajeErrorGuardado(error(5000, 500), form);
    expect(texto).toBe(TEXTO_5000_GUARDADO);
    expect(texto).toBe('Puede que esa localidad ya tenga una ficha de este trámite (activa o desactivada) o que el slug ya esté en uso: '
      + 'revisalo en Fichas por localidad. Si no es eso, recargá e intentá de nuevo.');
    expect(texto).not.toContain('Contacte al administrador');
    expect(texto).toContain('ya tenga una ficha');
    expect(texto).toContain('desactivada');
    expect(texto).toContain('slug');
    // Sigue cubriendo las otras causas del 500 genérico.
    expect(texto).toContain('recargá');
    // No se sabe cuál de los dos duplicados fue: no se marca ningún campo.
    expect(form.controls['slug'].errors).toBeNull();
  });

  it('un 409 4072 (duplicado, si el backend lo llega a mandar para fichas) nombra los dos duplicados posibles', () => {
    const texto = mensajeErrorGuardado(error(4072, 409, 'El objeto OrganismProcedureLocation con el identificador x existe.'), form);
    expect(texto).toBe('Esa localidad ya tiene una ficha de este trámite (activa o desactivada) o el slug ya está en uso. '
      + 'Revisalo en Fichas por localidad.');
    expect(texto).not.toContain('OrganismProcedureLocation');
    // No se sabe cuál de los dos UNIQUE fue: no se marca el slug.
    expect(form.controls['slug'].errors).toBeNull();
  });

  it('el 404 de la adopción (no vigente, deshabilitada o inexistente) tiene mensaje propio, nunca el del backend', () => {
    const texto = mensajeErrorGuardado(noExiste('OrganismProcedure'), form);
    expect(texto).toBe(TEXTO_ADOPCION_NO_VIGENTE);
    expect(texto).toBe('El trámite del organismo ya no está vigente (lo deshabilitaron, todavía no empezó a regir o ya venció), '
      + 'así que no se le pueden crear ni editar fichas. Revisá su vigencia en Trámites del organismo.');
    expect(texto).toContain('El trámite del organismo ya no está vigente');
    expect(texto).not.toContain('OrganismProcedure');
    expect(texto).not.toContain('identificador');
  });

  it('el 404 de la localidad y el de la ficha se distinguen del de la adopción', () => {
    const localidad = mensajeErrorGuardado(noExiste('Location'), form);
    const ficha = mensajeErrorGuardado(noExiste('OrganismProcedureLocation'), form);
    expect(localidad).toBe('La localidad elegida ya no existe. Recargá y elegí otra.');
    expect(localidad).toBe(TEXTO_LOCALIDAD_INEXISTENTE);
    expect(ficha).toBe('La ficha ya no existe o quedó fuera de tu alcance. Volvé al listado.');
    expect(ficha).toBe(TEXTO_FICHA_INEXISTENTE);
    [localidad, ficha].forEach((texto) => {
      expect(texto).not.toContain('identificador');
      expect(texto).not.toContain('Location');
    });
  });

  it('entidadInexistente no confunde OrganismProcedureLocation con OrganismProcedure ni con Location', () => {
    expect(entidadInexistente(noExiste('OrganismProcedure'))).toBe('adopcion');
    expect(entidadInexistente(noExiste('OrganismProcedureLocation'))).toBe('ficha');
    expect(entidadInexistente(noExiste('Location'))).toBe('localidad');
    expect(entidadInexistente(noExiste('AttentionPoint'))).toBeNull();
    expect(entidadInexistente(error(5000, 500))).toBeNull();
  });

  it('un 404 sin etiqueta reconocible usa el texto genérico de "ya no existe"', () => {
    const texto = mensajeErrorGuardado(error(4073, 404, 'Not found'), form);
    expect(texto).toBe('La ficha, el trámite del organismo o la localidad ya no existe o quedó fuera de tu alcance. Recargá e intentá de nuevo.');
    expect(texto).not.toContain('Not found');
  });

  it('el 400 4012 remite a los campos obligatorios', () => {
    expect(mensajeErrorGuardado(error(4012, 400, 'Verifique los campos de los elementos enviados.'), form))
      .toBe('Revisá los campos obligatorios: trámite del organismo, localidad y slug.');
  });

  it('un 403 dice que no hay permiso, y un error sin código conocido no muestra el mensaje del backend', () => {
    expect(mensajeErrorGuardado({ status: 403, error: { code: 403, message: 'Access Denied' } }, form)).toBe('No tenés permiso para guardar esta ficha.');
    expect(mensajeErrorGuardado({ status: 502, error: { message: 'Bad Gateway' } }, form))
      .toBe('El servidor tuvo un error y no pudo completar la operación. Esperá un momento e intentá de nuevo; si sigue, avisá a Soporte.');
    expect(mensajeErrorGuardado({ status: 0, error: null }, form))
      .toBe('No hay conexión con el servidor. Revisá tu conexión a internet e intentá de nuevo.');
    const conflicto = mensajeErrorGuardado({ status: 409, error: { code: 4999, message: 'Conflict' } }, form);
    expect(conflicto).toContain('choca con el estado actual del registro');
    expect(conflicto).not.toContain('Conflict');
    expect(mensajeErrorGuardado({ status: 418, error: { message: 'I am a teapot' } }, form)).toBe(FALLBACK_FICHA);
  });

  it('el 5000 de una acción (workflow, desactivar) no habla de duplicados', () => {
    const texto = mensajeErrorAccion(error(5000, 500));
    expect(texto).toContain('cambiado de estado');
    expect(texto).not.toContain('slug');
  });

  it('el 4091 no promete más de lo que hace el backend: habla de un guardado simultáneo, no de "mientras la editabas"', () => {
    expect(mensajeErrorGuardado(error(4091, 409), form)).toBe(TEXTO_EDICION_CONCURRENTE);
    expect(TEXTO_EDICION_CONCURRENTE)
      .toBe('Otra persona guardó la ficha en el mismo momento y tu cambio no se aplicó. Recargá para ver cómo quedó y volvé a intentar.');
    expect(TEXTO_EDICION_CONCURRENTE).toContain('en el mismo momento');
    expect(TEXTO_EDICION_CONCURRENTE).not.toContain('mientras la editabas');
  });

  it('una ficha sin contenido (backend viejo) tiene su texto', () => {
    expect(mensajeErrorGuardado(new FichaSinContenidoError(), form)).toBe(TEXTO_FICHA_SIN_CONTENIDO);
  });
});

describe('mensajeErrorAccion: siempre un texto propio, nunca el message del backend', () => {
  const CRUDO = 'response.code.4080 / Unexpected error: org.hibernate.StaleObjectStateException';
  const casos: Array<[string, unknown, string]> = [
    ['403', { status: 403, error: { code: 403, message: CRUDO } }, 'No tenés permiso para hacer esto con la ficha.'],
    ['4029', error(4029, 403, CRUDO), 'No tenés permiso'],
    ['4077', error(4077, 409, CRUDO), 'La ficha cambió de estado y esta acción ya no corresponde. Recargá para ver su estado actual.'],
    ['4091', error(4091, 409, CRUDO), 'en el mismo momento'],
    ['4073', error(4073, 404, CRUDO), 'La ficha ya no existe o quedó fuera de tu alcance.'],
    ['404 sin código', { status: 404, error: { message: CRUDO } }, 'ya no existe'],
    ['4012', error(4012, 400, CRUDO), 'no aceptó la acción'],
    ['4072', error(4072, 409, CRUDO), 'choca con otra ficha'],
    ['5000', error(5000, 500, CRUDO), 'No se pudo completar la acción'],
    ['502 sin código', { status: 502, error: { message: CRUDO } }, 'No se pudo completar la acción'],
    ['sin conexión', { status: 0, error: null }, 'No hay conexión'],
    ['401', { status: 401, error: { message: CRUDO } }, 'Tu sesión venció'],
  ];

  for (const [nombre, err, esperado] of casos) {
    it(`${nombre}: texto propio`, () => {
      const texto = mensajeErrorAccion(err);
      expect(texto).toContain(esperado);
      expect(texto).not.toContain('response.code');
      expect(texto).not.toContain('hibernate');
    });
  }

  it('un código que no se conoce cae en el texto genérico propio, no en el message', () => {
    expect(mensajeErrorAccion(error(4999, 418, CRUDO))).toBe(FALLBACK_ACCION);
    const rechazada = mensajeErrorAccion({ status: 400, error: { message: CRUDO } });
    expect(rechazada).toContain('El servidor rechazó la acción');
    expect(rechazada).not.toContain('formulario');
    const conflicto = mensajeErrorAccion({ status: 409, error: { code: 4999, message: CRUDO } });
    expect(conflicto).toContain('No se pudo completar la acción en el estado actual del registro');
    [rechazada, conflicto].forEach((texto) => {
      expect(texto).not.toContain('response.code');
      expect(texto).not.toContain('hibernate');
    });
    expect(mensajeErrorAccion(new Error(CRUDO))).toBe(FALLBACK_ACCION);
  });
});
