import { FormControl, FormGroup } from '@angular/forms';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { textoDeErrorHttp } from '@core/utils/http-error-text.utils';
import { FALLBACK_ORGANISMO, conflictosDeOrganismo, errorDeEliminarOrganismo, esOrganismoInexistente } from './organismo-save-error';

/** Lo que manda el backend en `message` (`messages.properties`): nunca tiene que llegar a la pantalla. */
const MENSAJES: Record<number, string> = {
  4053: 'Tipo de organización no encontrada.',
  4058: 'Organización no encontrada.',
  4067: 'No se puede eliminar el organismo porque tiene organismos hijos asociados.',
  4068: 'No se puede asignar un descendiente como padre del organismo.',
  4069: 'El acrónimo del organismo ya está en uso.',
  4070: 'Un organismo no puede ser su propio padre.',
  4071: 'La entidad relacionada no se encuentra activa.',
  4073: 'El objeto Ubicación con el identificador 3f2c8a10-0000-4000-8000-000000000001 no existe.',
};

const error = (status: number, code: number): unknown => ({ status, error: { code, message: MENSAJES[code] } });

describe('guardado de organismo: rechazos de OrganismService con texto propio', () => {
  let form: FormGroup;
  const CAMPOS = ['typeId', 'parentId', 'baseLocationId', 'nombre', 'acronym'];

  const guardar = (err: unknown, contexto = { esAlta: false, tieneSuperior: true }): string =>
    aplicarErrorDeGuardado(err, form, conflictosDeOrganismo(contexto), FALLBACK_ORGANISMO);
  const marcado = (control: string): unknown => form.controls[control].getError('server');
  const sinMarcas = (): boolean => CAMPOS.every((campo) => form.controls[campo].errors === null);

  beforeEach(() => {
    form = new FormGroup(Object.fromEntries(CAMPOS.map((campo) => [campo, new FormControl('x')])));
  });

  it('4069 (409): la sigla repetida se marca en la sigla', () => {
    expect(guardar(error(409, 4069))).toBe('Revisá el campo marcado.');
    expect(marcado('acronym')).toBe('Ya existe un organismo con esa sigla (también cuentan los dados de baja)');
  });

  describe('4071 (409): el tipo o el superior elegido está inactivo; el backend no dice cuál', () => {
    it('sin organismo superior solo puede ser el tipo: se marca en el tipo', () => {
      expect(guardar(error(409, 4071), { esAlta: true, tieneSuperior: false })).toBe('Revisá el campo marcado.');
      expect(marcado('typeId')).toBe('Ese tipo de organismo está inactivo. Elegí otro, o reactivalo en Tipos de organismo.');
      expect(marcado('parentId')).toBeNull();
    });

    it('con organismo superior no se adivina: va al banner nombrando los dos, sin marcar ninguno', () => {
      const texto = guardar(error(409, 4071), { esAlta: false, tieneSuperior: true });
      expect(texto).toBe('El tipo de organismo o el organismo superior que elegiste está inactivo. '
        + 'Elegí otro que esté activo, o reactivalo primero y volvé a guardar.');
      expect(sinMarcas()).toBeTrue();
    });

    it('no cae en el texto compartido del 409, que mandaba a recargar', () => {
      [true, false].forEach((tieneSuperior) => {
        const texto = guardar(error(409, 4071), { esAlta: false, tieneSuperior });
        expect(texto).not.toBe(textoDeErrorHttp(error(409, 4071), FALLBACK_ORGANISMO));
        expect(texto).not.toContain('Recargá');
      });
    });
  });

  it('4053 (404): el tipo elegido ya no existe, marcado en el tipo', () => {
    expect(guardar(error(404, 4053))).toBe('Revisá el campo marcado.');
    expect(marcado('typeId')).toBe('Ese tipo de organismo ya no existe. Elegí otro.');
  });

  it('4070 y 4068 (409): superior inválido, marcado en el organismo superior', () => {
    guardar(error(409, 4070));
    expect(marcado('parentId')).toBe('Un organismo no puede ser su propio organismo superior. Elegí otro.');
    guardar(error(409, 4068));
    expect(marcado('parentId')).toBe('Ese organismo depende de este: no puede ser su superior. Elegí otro.');
  });

  it('4073 (404): la localidad base ya no existe, marcada en la localidad', () => {
    expect(guardar(error(404, 4073))).toBe('Revisá el campo marcado.');
    expect(marcado('baseLocationId')).toBe('Esa localidad ya no existe. Elegí otra.');
  });

  describe('4058 (404): el organismo que se edita o el superior elegido', () => {
    it('en un alta es el superior: se marca en el organismo superior', () => {
      expect(guardar(error(404, 4058), { esAlta: true, tieneSuperior: true })).toBe('Revisá el campo marcado.');
      expect(marcado('parentId')).toBe('Ese organismo superior ya no existe. Elegí otro.');
    });

    it('al editar con superior no se sabe cuál falta: banner que nombra los dos', () => {
      const texto = guardar(error(404, 4058), { esAlta: false, tieneSuperior: true });
      expect(texto).toBe('El organismo que estás editando, o el organismo superior que elegiste, ya no existe. '
        + 'Recargá la página para ver cuál de los dos falta.');
      expect(sinMarcas()).toBeTrue();
    });

    it('al editar sin superior es el organismo mismo: texto compartido de "ya no existe"', () => {
      const texto = guardar(error(404, 4058), { esAlta: false, tieneSuperior: false });
      expect(texto).toContain('ya no existe o quedó fuera de tu alcance');
      expect(sinMarcas()).toBeTrue();
    });
  });

  it('ningún rechazo muestra el message del backend', () => {
    [[409, 4069], [409, 4071], [404, 4053], [409, 4070], [409, 4068], [404, 4073], [404, 4058]].forEach(([status, code]) => {
      [{ esAlta: true, tieneSuperior: true }, { esAlta: false, tieneSuperior: false }].forEach((contexto) => {
        const texto = guardar(error(status, code), contexto);
        const visibles = [texto, ...CAMPOS.map((campo) => String(marcado(campo) ?? ''))].join(' ');
        expect(visibles).not.toContain(MENSAJES[code]);
        expect(visibles).not.toContain('identificador');
        expect(visibles).not.toContain('Organización');
      });
    });
  });
});

describe('eliminar un organismo: errorDeEliminarOrganismo', () => {
  it('4067 (409, tiene organismos hijos activos): dice el motivo y qué hacer, no manda a recargar', () => {
    const texto = errorDeEliminarOrganismo(error(409, 4067));
    expect(texto).toBe('No se puede eliminar: tiene organismos activos que dependen de él. '
      + 'Asignales otro organismo superior o dalos de baja primero.');
    expect(texto).not.toContain('Recargá');
    expect(texto).not.toContain(MENSAJES[4067]);
  });

  it('cualquier otro error devuelve null (sigue el texto compartido de la confirmación)', () => {
    [error(404, 4058), error(409, 4066), { status: 500, error: { code: 5000 } }, { status: 0, error: null }, new Error('x')]
      .forEach((err) => expect(errorDeEliminarOrganismo(err)).toBeNull());
  });
});

describe('lectura de la ficha de organismo: ¿no existe?', () => {
  it('404 o código 4058 / 4073: el organismo no existe (también con la forma que tira el mock)', () => {
    expect(esOrganismoInexistente(error(404, 4058))).toBeTrue();
    expect(esOrganismoInexistente({ status: 404 })).toBeTrue();
    expect(esOrganismoInexistente({ error: { code: 4058 } })).toBeTrue();
    expect(esOrganismoInexistente({ error: { code: 4073 } })).toBeTrue();
  });

  it('cualquier otro fallo (sin conexión, 500, 403) se puede reintentar', () => {
    expect(esOrganismoInexistente({ status: 0 })).toBeFalse();
    expect(esOrganismoInexistente({ status: 500, error: { code: 5000 } })).toBeFalse();
    expect(esOrganismoInexistente({ status: 403, error: { code: 4003 } })).toBeFalse();
    expect(esOrganismoInexistente(new Error('falló'))).toBeFalse();
    expect(esOrganismoInexistente(null)).toBeFalse();
  });
});
