import { FormGroup } from '@angular/forms';
import { FichaFormData, FichaLocalVM } from '@features/fichas-locales';
import { ContextoDeValidacion, FichaForm, aValorDeFicha, controlesDeFicha, revalidar, volcarFicha } from './ficha-form-campos';

const FICHA: FichaLocalVM = {
  id: 'f-1', slug: 'Licencia_Vieja', estado: 'BORRADOR', activa: false, version: 1,
  adopcionId: 'a-1', localidadId: 'l-1', url: null, requisitos: 'DNI vigente', costos: null,
  plantillaId: 'p-1', plantillaTitulo: 'Obtener la licencia de conducir',
  organismoId: 'o-1', organismoNombre: 'Municipalidad de Posadas', localidadNombre: 'Posadas',
};

function datos(ficha: FichaLocalVM | null): FichaFormData {
  return {
    ficha,
    adopcion: null,
    localidades: [],
    ocupadas: { localidadIds: ['l-1', 'l-2'], localidadIdsDesactivadas: ['l-2'], slugs: ['slug-en-uso'] },
  };
}

describe('campos del formulario de ficha', () => {
  let contexto: ContextoDeValidacion;
  let form: FichaForm;

  beforeEach(() => {
    contexto = { isEdit: false, datos: null };
    form = new FormGroup(controlesDeFicha(() => contexto));
  });

  describe('validadores', () => {
    it('antes de que lleguen los datos no hay duplicados que marcar', () => {
      form.controls.localidadId.setValue('l-1');
      form.controls.slug.setValue('slug-en-uso');
      expect(form.controls.localidadId.valid).toBeTrue();
      expect(form.controls.slug.valid).toBeTrue();
    });

    it('en alta, la localidad que ya tiene ficha no se acepta, y dice si esa ficha está desactivada', () => {
      contexto.datos = datos(null);
      form.controls.localidadId.setValue('l-1');
      expect(form.controls.localidadId.errors).toEqual({ localidadOcupada: true });
      form.controls.localidadId.setValue('l-2');
      expect(form.controls.localidadId.errors).toEqual({ localidadDesactivada: true });
    });

    it('en edición la localidad no se valida contra las ocupadas: no cambia', () => {
      contexto = { isEdit: true, datos: datos(FICHA) };
      form.controls.localidadId.setValue('l-1');
      expect(form.controls.localidadId.valid).toBeTrue();
    });

    it('el slug es obligatorio, tiene que dejar algo al canonicalizarlo y no puede repetirse', () => {
      contexto.datos = datos(null);
      const { slug } = form.controls;
      expect(slug.hasError('required')).toBeTrue();
      slug.setValue('¡¡¡');
      expect(slug.errors).toEqual({ slugVacio: true });
      slug.setValue('Slug en uso');
      expect(slug.errors).toEqual({ slugRepetido: true });
      slug.setValue('a'.repeat(256));
      expect(slug.hasError('maxlength')).toBeTrue();
      slug.setValue('slug-libre');
      expect(slug.valid).toBeTrue();
    });

    it('la URL es opcional y cada forma de estar mal tiene su error', () => {
      const { url } = form.controls;
      expect(url.valid).toBeTrue();
      url.setValue('www.misiones.gob.ar');
      expect(url.errors).toEqual({ urlEsquema: true });
      url.setValue('https://www.misiones .gob.ar');
      expect(url.errors).toEqual({ urlEspacios: true });
      url.setValue('https://');
      expect(url.errors).toEqual({ urlIncompleta: true });
    });

    it('en edición no deja reactivar una ficha si la localidad ya tiene otra activa', () => {
      contexto = { isEdit: true, datos: datos(FICHA) };
      form.controls.activa.setValue(true);
      expect(form.controls.activa.errors).toEqual({ reactivaDuplicada: true });
      form.controls.activa.setValue(false);
      expect(form.controls.activa.valid).withContext('dejarla desactivada no duplica').toBeTrue();
    });

    it('reactivar se permite si la otra ficha de la localidad también está desactivada, y no aplica en alta', () => {
      contexto = { isEdit: true, datos: datos({ ...FICHA, localidadId: 'l-2' }) };
      form.controls.activa.setValue(true);
      expect(form.controls.activa.valid).toBeTrue();

      contexto = { isEdit: false, datos: datos(null) };
      revalidar(form, 'activa');
      expect(form.controls.activa.valid).toBeTrue();
    });

    it('revalidar vuelve a leer el contexto sin emitir cambios', () => {
      form.controls.slug.setValue('slug-en-uso');
      const emisiones = jasmine.createSpy('valueChanges');
      form.valueChanges.subscribe(emisiones);
      contexto.datos = datos(null);

      revalidar(form, 'slug');

      expect(form.controls.slug.errors).toEqual({ slugRepetido: true });
      expect(emisiones).not.toHaveBeenCalled();
    });
  });

  describe('ficha → form → valor a guardar', () => {
    it('la ficha leída se vuelca con los `null` como vacío, queda sin cambios y con la localidad fija', () => {
      volcarFicha(form, FICHA);

      expect(form.getRawValue()).toEqual({
        adopcion: '', localidadId: 'l-1', slug: 'Licencia_Vieja', url: '', requisitos: 'DNI vigente', costos: '', activa: false,
      });
      expect(form.pristine).toBeTrue();
      expect(form.controls.localidadId.disabled).toBeTrue();
    });

    it('viajan todos los campos, también los deshabilitados, con el trámite del organismo', () => {
      volcarFicha(form, FICHA);
      form.controls.slug.setValue('licencia-nueva');
      form.controls.activa.disable();

      expect(aValorDeFicha(form, 'a-1', null)).toEqual({
        adopcionId: 'a-1', localidadId: 'l-1', slug: 'licencia-nueva', conservarSlug: false,
        url: '', requisitos: 'DNI vigente', costos: '', activa: false,
      });
    });

    it('el slug que no se tocó viaja tal cual se leyó, marcado para conservarlo', () => {
      volcarFicha(form, FICHA);

      const valor = aValorDeFicha(form, 'a-1', 'Licencia_Vieja');

      expect(valor.slug).toBe('Licencia_Vieja');
      expect(valor.conservarSlug).toBeTrue();
    });
  });
});
