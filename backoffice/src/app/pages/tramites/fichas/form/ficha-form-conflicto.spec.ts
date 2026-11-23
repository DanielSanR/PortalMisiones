import { FormGroup } from '@angular/forms';
import { FichaLocalVM } from '@features/fichas-locales';
import { FichaForm, controlesDeFicha, volcarFicha } from './ficha-form-campos';
import { baseDe, rebasar } from './ficha-form-conflicto';

const LEIDA: FichaLocalVM = {
  id: 'f-1', slug: 'obtener-licencia-posadas', estado: 'BORRADOR', activa: true, version: 1,
  adopcionId: 'a-1', localidadId: 'l-1', url: 'https://licencias.posadas.gob.ar',
  requisitos: 'DNI vigente', costos: 'Gratis',
  plantillaId: 'p-1', plantillaTitulo: 'Obtener la licencia de conducir',
  organismoId: 'o-1', organismoNombre: 'Municipalidad de Posadas', localidadNombre: 'Posadas',
};

/** El form tal como queda al abrir la edición de `ficha`. */
function formDe(ficha: FichaLocalVM): FichaForm {
  const form: FichaForm = new FormGroup(controlesDeFicha(() => ({ isEdit: true, datos: null })));
  volcarFicha(form, ficha);
  return form;
}

function editar(form: FichaForm, campo: 'slug' | 'url' | 'requisitos' | 'costos', valor: string): void {
  form.controls[campo].setValue(valor);
  form.controls[campo].markAsDirty();
}

describe('rebase del formulario de ficha', () => {
  const sinAdoptar = (): void => undefined;

  it('la base de la comparación es la versión, el estado y si está activa', () => {
    expect(baseDe({ ...LEIDA, version: 7, estado: 'EN_REVISION', activa: false }))
      .toEqual({ version: 7, estado: 'EN_REVISION', activa: false });
  });

  it('sin cambios propios, el form toma la ficha actual y no hay conflicto: se avisa la versión', () => {
    const form = formDe(LEIDA);
    const actual: FichaLocalVM = { ...LEIDA, version: 2, requisitos: 'DNI y certificado', costos: null };

    const rebase = rebasar(form, LEIDA, actual, sinAdoptar);

    expect(form.getRawValue().requisitos).toBe('DNI y certificado');
    expect(form.getRawValue().costos).withContext('`null` del backend = vacío').toBe('');
    expect(form.pristine).toBeTrue();
    expect(rebase).toEqual({ conflicto: null, fichaActualizada: 2, activaRestablecida: false });
  });

  it('el campo editado conserva lo escrito y el que no se tocó toma el valor nuevo, sin ensuciarse', () => {
    const form = formDe(LEIDA);
    editar(form, 'costos', '$ 500');
    const actual: FichaLocalVM = { ...LEIDA, version: 2, requisitos: 'DNI y certificado' };

    const rebase = rebasar(form, LEIDA, actual, sinAdoptar);

    expect(form.getRawValue().costos).toBe('$ 500');
    expect(form.controls.costos.dirty).toBeTrue();
    expect(form.getRawValue().requisitos).toBe('DNI y certificado');
    expect(form.controls.requisitos.pristine).toBeTrue();
    expect(rebase.conflicto).toEqual({ actual, enDisputa: [] });
    expect(rebase.fichaActualizada).toBeNull();
  });

  it('un campo que cambiaron los dos, con valores distintos, queda en disputa con su etiqueta', () => {
    const form = formDe(LEIDA);
    editar(form, 'costos', '$ 500');
    editar(form, 'url', 'https://mio.gob.ar');
    const actual: FichaLocalVM = { ...LEIDA, version: 2, costos: '$ 900', url: 'https://otra.gob.ar' };

    const rebase = rebasar(form, LEIDA, actual, sinAdoptar);

    expect(rebase.conflicto?.enDisputa).toEqual(['URL del trámite', 'Costos']);
    expect(form.getRawValue().costos).toBe('$ 500');
    expect(form.getRawValue().url).toBe('https://mio.gob.ar');
  });

  it('si lo escrito coincide con lo que hay ahora, deja de contar como cambio', () => {
    const form = formDe(LEIDA);
    editar(form, 'costos', '$ 900');

    const rebase = rebasar(form, LEIDA, { ...LEIDA, version: 2, costos: '$ 900' }, sinAdoptar);

    expect(form.controls.costos.pristine).toBeTrue();
    expect(rebase).toEqual({ conflicto: null, fichaActualizada: 2, activaRestablecida: false });
  });

  it('el slug escrito se compara canonicalizado, como se va a guardar', () => {
    const form = formDe(LEIDA);
    editar(form, 'slug', 'Licencia Posadas');

    const rebase = rebasar(form, LEIDA, { ...LEIDA, version: 2, slug: 'licencia-posadas' }, sinAdoptar);

    expect(form.controls.slug.pristine).toBeTrue();
    expect(form.getRawValue().slug).toBe('licencia-posadas');
    expect(rebase.conflicto).toBeNull();
  });

  it('si la ficha quedó publicada y activa mientras acá se la desactivaba, "activa" vuelve a prendido y se avisa', () => {
    const form = formDe(LEIDA);
    form.controls.activa.setValue(false);
    form.controls.activa.markAsDirty();

    const rebase = rebasar(form, LEIDA, { ...LEIDA, version: 2, estado: 'PUBLICADO' }, sinAdoptar);

    expect(rebase.activaRestablecida).toBeTrue();
    expect(form.getRawValue().activa).toBeTrue();
    expect(rebase.conflicto).withContext('era el único cambio propio').toBeNull();
  });

  it('desactivar una ficha que no quedó publicada sigue siendo un cambio propio', () => {
    const form = formDe(LEIDA);
    form.controls.activa.setValue(false);
    form.controls.activa.markAsDirty();

    const rebase = rebasar(form, LEIDA, { ...LEIDA, version: 2, requisitos: 'Otros' }, sinAdoptar);

    expect(rebase.activaRestablecida).toBeFalse();
    expect(form.getRawValue().activa).toBeFalse();
    expect(rebase.conflicto?.enDisputa).toEqual([]);
  });

  it('la ficha actual se adopta con los campos ya rebasados', () => {
    const form = formDe(LEIDA);
    const actual: FichaLocalVM = { ...LEIDA, version: 2, requisitos: 'DNI y certificado' };
    let requisitosAlAdoptar = '';
    const adoptar = jasmine.createSpy('adoptar').and.callFake(() => { requisitosAlAdoptar = form.getRawValue().requisitos; });

    rebasar(form, LEIDA, actual, adoptar);

    expect(adoptar).toHaveBeenCalledOnceWith(actual);
    expect(requisitosAlAdoptar).toBe('DNI y certificado');
  });

  it('una URL actual que hoy no valida queda marcada para que se vea su error', () => {
    const form = formDe(LEIDA);

    rebasar(form, LEIDA, { ...LEIDA, version: 2, url: 'www.sin-esquema.gob.ar' }, sinAdoptar);

    expect(form.controls.url.hasError('urlEsquema')).toBeTrue();
    expect(form.controls.url.touched).toBeTrue();
  });
});
