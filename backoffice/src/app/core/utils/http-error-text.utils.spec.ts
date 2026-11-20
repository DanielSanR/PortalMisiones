import { HttpErrorResponse } from '@angular/common/http';
import { TipoDeErrorHttp, errorDeAccionPorCodigo, textoDeErrorHttp, tipoDeErrorHttp } from './http-error-text.utils';

/** Lo que el backend manda en `message`: nunca tiene que llegar a la pantalla. */
const CRUDO = 'El rol autenticado no tiene permisos para crear usuarios. / org.hibernate.exception';
const FALLBACK = 'No se pudo guardar. Intentá de nuevo.';

const http = (status: number, code?: number): HttpErrorResponse =>
  new HttpErrorResponse({ status, error: { code, message: CRUDO, details: CRUDO } });

describe('tipoDeErrorHttp', () => {
  const POR_STATUS: [number, TipoDeErrorHttp][] = [
    [0, 'sin-conexion'], [401, 'sesion-vencida'], [403, 'sin-permiso'], [404, 'inexistente'], [409, 'conflicto'],
    [400, 'datos-rechazados'], [422, 'datos-rechazados'], [500, 'servidor'], [502, 'servidor'], [503, 'servidor'],
    [418, 'otro'], [429, 'otro'],
  ];

  POR_STATUS.forEach(([status, tipo]) => {
    it(`HTTP ${status} → ${tipo}`, () => expect(tipoDeErrorHttp(http(status))).toBe(tipo));
  });

  it('con status, el status manda sobre el código de negocio', () => {
    expect(tipoDeErrorHttp(http(409, 4012))).toBe('conflicto');
  });

  it('sin status se decide por los códigos de negocio genéricos', () => {
    const sinStatus = (code: number): unknown => ({ error: { code, message: CRUDO } });
    expect(tipoDeErrorHttp(sinStatus(4029))).toBe('sin-permiso');
    expect(tipoDeErrorHttp(sinStatus(4073))).toBe('inexistente');
    expect(tipoDeErrorHttp(sinStatus(4072))).toBe('conflicto');
    expect(tipoDeErrorHttp(sinStatus(4012))).toBe('datos-rechazados');
    expect(tipoDeErrorHttp(sinStatus(5000))).toBe('servidor');
    expect(tipoDeErrorHttp(sinStatus(4007))).toBe('sesion-vencida');
    expect(tipoDeErrorHttp(sinStatus(4999))).toBe('otro');
  });

  it('lo que no es un error HTTP es `otro`', () => {
    [new Error(CRUDO), null, undefined, 'texto', {}, { error: null }, { error: { message: CRUDO } }]
      .forEach((err) => expect(tipoDeErrorHttp(err)).toBe('otro'));
  });
});

describe('textoDeErrorHttp: texto propio para un error no previsto', () => {
  it('sin conexión (status 0)', () => {
    expect(textoDeErrorHttp(http(0), FALLBACK)).toBe('No hay conexión con el servidor. Revisá tu conexión a internet e intentá de nuevo.');
  });

  it('401: sesión vencida', () => {
    expect(textoDeErrorHttp(http(401), FALLBACK)).toBe('Tu sesión venció. Volvé a iniciar sesión e intentá de nuevo.');
  });

  it('403: sin permiso para esta acción', () => {
    expect(textoDeErrorHttp(http(403, 4029), FALLBACK))
      .toBe('No tenés permiso para hacer esto. Si creés que deberías tenerlo, pedíselo a un administrador.');
  });

  it('404 en un formulario: no da por desaparecido lo que se edita (puede faltar algo elegido en un selector)', () => {
    const texto = textoDeErrorHttp(http(404, 4058), FALLBACK);
    expect(texto).toBe('Lo que estás guardando, o algo que elegiste en el formulario, ya no existe o quedó fuera de tu alcance. '
      + 'Recargá la página para ver las opciones actuales y volvé a intentar.');
    expect(texto).not.toContain('El registro ya no existe');
    // Mismo texto para cualquier 404: el del registro (4073) y el de un selector (4058 organismo, 4059 rol, 4053 tipo).
    [4073, 4059, 4053].forEach((code) => expect(textoDeErrorHttp(http(404, code), FALLBACK)).toBe(texto));
  });

  it('404 en una acción sin formulario: el registro ya no existe', () => {
    expect(textoDeErrorHttp(http(404, 4073), FALLBACK, { contexto: 'accion' }))
      .toBe('El registro ya no existe o quedó fuera de tu alcance. Recargá la página para ver el estado actual.');
  });

  it('409 no declarado en un formulario: conflicto con el estado actual', () => {
    expect(textoDeErrorHttp(http(409, 4999), FALLBACK))
      .toBe('Lo que querés guardar choca con el estado actual del registro: puede que alguien lo haya cambiado '
        + 'o que ya exista otro igual. Recargá la página y volvé a intentar.');
  });

  it('400 / 422 no declarado: datos que el servidor no aceptó, revisar el formulario', () => {
    const esperado = 'El servidor no aceptó los datos enviados. Revisá el formulario e intentá de nuevo.';
    expect(textoDeErrorHttp(http(400, 4012), FALLBACK)).toBe(esperado);
    expect(textoDeErrorHttp(http(422), FALLBACK)).toBe(esperado);
  });

  it('5xx: error del servidor, reintentar más tarde', () => {
    const esperado = 'El servidor tuvo un error y no pudo completar la operación. Esperá un momento e intentá de nuevo; si sigue, avisá a Soporte.';
    expect(textoDeErrorHttp(http(500, 5000), FALLBACK)).toBe(esperado);
    expect(textoDeErrorHttp(http(503), FALLBACK)).toBe(esperado);
  });

  it('el resto: el fallback de quien llama', () => {
    expect(textoDeErrorHttp(http(418), FALLBACK)).toBe(FALLBACK);
    expect(textoDeErrorHttp(new Error(CRUDO), FALLBACK)).toBe(FALLBACK);
    expect(textoDeErrorHttp({ error: { message: CRUDO } }, FALLBACK)).toBe(FALLBACK);
  });

  describe('en una acción sin formulario (eliminar, desactivar…)', () => {
    const EN_USO_O_CAMBIADO = 'Si otros datos lo están usando, primero quitá o reasigná lo que depende de él; '
      + 'si alguien lo cambió recién, recargá la página y volvé a intentar.';

    it('409 no declarado: cubre "en uso" y "cambió", y recargar no es el único consejo', () => {
      const texto = textoDeErrorHttp(http(409, 4999), FALLBACK, { contexto: 'accion' });
      expect(texto).toBe(`No se pudo completar la acción en el estado actual del registro. ${EN_USO_O_CAMBIADO}`);
      expect(texto).not.toContain('formulario');
    });

    it('400 / 422 no declarado: no manda a revisar un formulario que no existe ni solo a recargar', () => {
      const texto = textoDeErrorHttp(http(400, 4012), FALLBACK, { contexto: 'accion' });
      expect(texto).toBe(`El servidor rechazó la acción tal como está el registro. ${EN_USO_O_CAMBIADO}`);
      expect(texto).not.toContain('formulario');
      expect(textoDeErrorHttp(http(422), FALLBACK, { contexto: 'accion' })).toBe(texto);
    });

    it('en los dos, el consejo de recargar llega después del de liberar el registro', () => {
      [409, 400].forEach((status) => {
        const texto = textoDeErrorHttp(http(status), FALLBACK, { contexto: 'accion' });
        expect(texto.indexOf('quitá o reasigná')).toBeGreaterThan(-1);
        expect(texto.indexOf('quitá o reasigná')).toBeLessThan(texto.indexOf('recargá la página'));
      });
    });
  });

  it('`solo` limita los tipos con texto compartido: el resto cae en el fallback', () => {
    const solo = ['sin-conexion', 'servidor'] as const;
    expect(textoDeErrorHttp(http(0), FALLBACK, { solo }))
      .toBe('No hay conexión con el servidor. Revisá tu conexión a internet e intentá de nuevo.');
    expect(textoDeErrorHttp(http(404), FALLBACK, { solo })).toBe(FALLBACK);
  });

  it('nunca devuelve el message ni el details del backend; todos los textos dicen qué hacer', () => {
    [0, 400, 401, 403, 404, 409, 418, 422, 500, 503].forEach((status) => {
      (['formulario', 'accion'] as const).forEach((contexto) => {
        const texto = textoDeErrorHttp(http(status, 4029), FALLBACK, { contexto });
        expect(texto).not.toContain('crear usuarios');
        expect(texto).not.toContain('hibernate');
        expect(texto.length).toBeGreaterThan(20);
      });
    });
  });
});

describe('errorDeAccionPorCodigo', () => {
  const errorDeAccion = errorDeAccionPorCodigo({ 4067: 'Tiene hijos activos.' });

  it('devuelve el texto propio del código declarado, sea cual sea el status', () => {
    expect(errorDeAccion(http(409, 4067))).toBe('Tiene hijos activos.');
    expect(errorDeAccion({ error: { code: 4067, message: CRUDO } })).toBe('Tiene hijos activos.');
  });

  it('para cualquier otro error devuelve null: la confirmación sigue con el texto compartido', () => {
    [http(409, 4066), http(409), http(500, 5000), new Error(CRUDO), null, undefined, { error: null }]
      .forEach((err) => expect(errorDeAccion(err)).toBeNull());
  });
});
