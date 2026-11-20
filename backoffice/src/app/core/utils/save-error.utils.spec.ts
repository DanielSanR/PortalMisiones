import { FormControl, FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ConflictoDeCampo, aplicarErrorDeGuardado } from './save-error.utils';

const CRUDO = 'El rol autenticado no tiene permisos para crear usuarios.';
const FALLBACK = 'No se pudo guardar el registro. Intentá de nuevo.';
const CONFLICTOS: ConflictoDeCampo[] = [
  { code: 4072, control: 'slug', mensaje: 'Ya existe uno con ese slug' },
  { code: 4080, mensaje: 'Las fechas se pisan con otra vigencia.' },
];

// Textos LITERALES que ve la persona en el banner del formulario (no las constantes del código: si alguien
// cambia un texto, este spec tiene que enterarse).
const SIN_PERMISO = 'No tenés permiso para hacer esto. Si creés que deberías tenerlo, pedíselo a un administrador.';
const INEXISTENTE = 'Lo que estás guardando, o algo que elegiste en el formulario, ya no existe o quedó fuera de tu alcance. '
  + 'Recargá la página para ver las opciones actuales y volvé a intentar.';
const CONFLICTO = 'Lo que querés guardar choca con el estado actual del registro: puede que alguien lo haya cambiado '
  + 'o que ya exista otro igual. Recargá la página y volvé a intentar.';
const DATOS_RECHAZADOS = 'El servidor no aceptó los datos enviados. Revisá el formulario e intentá de nuevo.';
const SERVIDOR = 'El servidor tuvo un error y no pudo completar la operación. Esperá un momento e intentá de nuevo; si sigue, avisá a Soporte.';

const http = (status: number, code?: number): HttpErrorResponse =>
  new HttpErrorResponse({ status, error: { code, message: CRUDO } });

describe('aplicarErrorDeGuardado', () => {
  let form: FormGroup;
  const traducir = (err: unknown): string => aplicarErrorDeGuardado(err, form, CONFLICTOS, FALLBACK);

  beforeEach(() => {
    form = new FormGroup({ slug: new FormControl('repetido') });
  });

  it('un conflicto declarado con `control` se marca en el campo', () => {
    expect(traducir(http(409, 4072))).toBe('Revisá el campo marcado.');
    expect(form.controls['slug'].getError('server')).toBe('Ya existe uno con ese slug');
    expect(form.controls['slug'].touched).toBeTrue();
  });

  it('un conflicto declarado sin `control` va al banner con su texto', () => {
    expect(traducir(http(409, 4080))).toBe('Las fechas se pisan con otra vigencia.');
    expect(form.valid).toBeTrue();
  });

  describe('sin conflicto declarado: texto propio según el tipo, nunca el message del backend', () => {
    const CASOS: [string, unknown, string][] = [
      ['sin conexión', http(0), 'No hay conexión con el servidor. Revisá tu conexión a internet e intentá de nuevo.'],
      ['401', http(401, 4007), 'Tu sesión venció. Volvé a iniciar sesión e intentá de nuevo.'],
      ['403', http(403, 4029), SIN_PERMISO],
      ['404', http(404, 4073), INEXISTENTE],
      ['404 de algo elegido en un selector (4058 organismo)', http(404, 4058), INEXISTENTE],
      ['409 no declarado', http(409, 4091), CONFLICTO],
      ['400 no declarado', http(400, 4012), DATOS_RECHAZADOS],
      ['422', http(422), DATOS_RECHAZADOS],
      ['500', http(500, 5000), SERVIDOR],
      ['503', http(503), SERVIDOR],
      ['otro status', http(418, 4999), FALLBACK],
      ['un Error cualquiera', new Error(CRUDO), FALLBACK],
      ['cuerpo con message y sin status', { error: { message: CRUDO } }, FALLBACK],
    ];

    CASOS.forEach(([nombre, err, esperado]) => {
      it(nombre, () => {
        const texto = traducir(err);
        expect(texto).toBe(esperado);
        expect(texto).not.toContain('crear usuarios');
        expect(form.valid).toBeTrue();
      });
    });
  });

  it('gana el primer conflicto cuyo `cuando` coincide; el genérico del mismo código queda para el resto', () => {
    const conDetalle: ConflictoDeCampo[] = [
      { code: 4029, cuando: (body) => (body as { details?: string }).details === 'rol', control: 'slug', mensaje: 'Por el rol' },
      { code: 4029, mensaje: 'Sin permiso para esto' },
    ];
    const err = (details: string): HttpErrorResponse =>
      new HttpErrorResponse({ status: 403, error: { code: 4029, message: CRUDO, details } });

    expect(aplicarErrorDeGuardado(err('otro'), form, conDetalle, FALLBACK)).toBe('Sin permiso para esto');
    expect(form.valid).toBeTrue();
    expect(aplicarErrorDeGuardado(err('rol'), form, conDetalle, FALLBACK)).toBe('Revisá el campo marcado.');
    expect(form.controls['slug'].getError('server')).toBe('Por el rol');
  });

  it('un conflicto con `control` que el form no tiene va al banner con su texto', () => {
    const conflictos: ConflictoDeCampo[] = [{ code: 4058, control: 'organismoId', mensaje: 'Ese organismo ya no existe. Elegí otro.' }];
    expect(aplicarErrorDeGuardado(http(404, 4058), form, conflictos, FALLBACK)).toBe('Ese organismo ya no existe. Elegí otro.');
    expect(aplicarErrorDeGuardado(http(404, 4058), undefined, conflictos, FALLBACK)).toBe('Ese organismo ya no existe. Elegí otro.');
    expect(form.valid).toBeTrue();
  });

  it('el caso que motivó la regla: un 4029 no declarado no muestra "…para crear usuarios"', () => {
    const texto = aplicarErrorDeGuardado(http(403, 4029), form, [], FALLBACK);
    expect(texto).toBe(SIN_PERMISO);
  });
});
