import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { FichasLocalesMockDataSource } from './fichas-locales.mock.datasource';
import { FichaLocalFormValue } from '../models/ficha-local.vm';

const FORM: FichaLocalFormValue = {
  adopcionId: 'op-1',
  localidadId: 'loc-garupa',
  slug: 'obtener-licencia-de-conducir-garupa',
  url: '',
  requisitos: 'DNI',
  costos: '',
  activa: true,
};

/** Código de negocio de un error del mock (`{ error: { code } }`). */
async function codigoDeError(promesa: Promise<unknown>): Promise<number | null> {
  try {
    await promesa;
    return null;
  } catch (err) {
    return (err as { error?: { code?: number } }).error?.code ?? null;
  }
}

describe('FichasLocalesMockDataSource', () => {
  let ds: FichasLocalesMockDataSource;

  beforeEach(() => {
    ds = new FichasLocalesMockDataSource();
  });

  it('el alta queda en BORRADOR, versión 1, con el contenido completo', async () => {
    const creada = await firstValueFrom(ds.create(FORM));
    expect(creada.estado).toBe('BORRADOR');
    expect(creada.version).toBe(1);
    expect(creada.contenidoCompleto).toBeTrue();
    expect(creada.requisitos).toBe('DNI');
  });

  it('cada edición y cada transición suma una versión', async () => {
    const creada = await firstValueFrom(ds.create(FORM));
    const editada = await firstValueFrom(ds.update(creada.id, { ...FORM, costos: '$5' }, creada.estado));
    expect(editada.version).toBe(2);
    expect(editada.costos).toBe('$5');
    const enRevision = await firstValueFrom(ds.transicion(creada.id, 'submit-review'));
    expect(enRevision.estado).toBe('EN_REVISION');
    expect(enRevision.version).toBe(3);
    const publicada = await firstValueFrom(ds.transicion(creada.id, 'publish'));
    expect(publicada.estado).toBe('PUBLICADO');
    expect(publicada.version).toBe(4);
  });

  it('una transición inválida responde 4077 y no cambia nada', async () => {
    const creada = await firstValueFrom(ds.create(FORM));
    expect(await codigoDeError(firstValueFrom(ds.transicion(creada.id, 'publish')))).toBe(4077);
    const releida = await firstValueFrom(ds.getById(creada.id));
    expect(releida.estado).toBe('BORRADOR');
    expect(releida.version).toBe(1);
  });

  it('DESPUBLICADO → PUBLICADO sin revisión (republicar)', async () => {
    const republicada = await firstValueFrom(ds.transicion('fl-4', 'publish'));
    expect(republicada.estado).toBe('PUBLICADO');
  });

  it('desactivar una publicada la despublica', async () => {
    await firstValueFrom(ds.desactivar('fl-1'));
    const f = await firstValueFrom(ds.getById('fl-1'));
    expect(f.activa).toBeFalse();
    expect(f.estado).toBe('DESPUBLICADO');
  });

  it('el PUT conserva el estado aunque el request mande otro (R-1)', async () => {
    const editada = await firstValueFrom(ds.update('fl-8', { ...FORM, costos: '$1' }, 'PUBLICADO'));
    expect(editada.estado).toBe('EN_REVISION');
  });

  it('ficha inexistente → 4073; campos NOT NULL faltantes → 5000', async () => {
    expect(await codigoDeError(firstValueFrom(ds.getById('no-existe')))).toBe(4073);
    expect(await codigoDeError(firstValueFrom(ds.transicion('no-existe', 'publish')))).toBe(4073);
    expect(await codigoDeError(firstValueFrom(ds.create({ ...FORM, localidadId: '' })))).toBe(5000);
  });

  describe('unicidad (V2.27): responde el 5000 genérico, como el backend', () => {
    it('otra ficha de la misma adopción y localidad, aunque esté desactivada', async () => {
      // fl-1: op-1 + Posadas, activa. fl-6: op-2 + Garupá, desactivada.
      expect(await codigoDeError(firstValueFrom(ds.create({ ...FORM, localidadId: 'loc-posadas' })))).toBe(5000);
      expect(await codigoDeError(firstValueFrom(ds.create({ ...FORM, adopcionId: 'op-2' })))).toBe(5000);
    });

    it('el mismo slug dentro de la adopción; en otra adopción se puede repetir', async () => {
      const slug = 'obtener-licencia-de-conducir-posadas'; // el de fl-1 (op-1)
      expect(await codigoDeError(firstValueFrom(ds.create({ ...FORM, slug })))).toBe(5000);
      const enOtraAdopcion = await firstValueFrom(ds.create({ ...FORM, adopcionId: 'op-3', slug }));
      expect(enOtraAdopcion.slug).toBe(slug);
    });

    it('editar una ficha no choca consigo misma, pero sí con las demás', async () => {
      const fl3: FichaLocalFormValue = {
        ...FORM, localidadId: 'loc-eldorado', slug: 'obtener-licencia-de-conducir-eldorado',
      };
      const editada = await firstValueFrom(ds.update('fl-3', { ...fl3, costos: '$1' }, 'BORRADOR'));
      expect(editada.costos).toBe('$1');
      expect(await codigoDeError(firstValueFrom(ds.update('fl-3', { ...fl3, localidadId: 'loc-obera' }, 'BORRADOR')))).toBe(5000);
    });
  });
});

describe('FichasLocalesMockDataSource · semillas según la fuente de adopciones', () => {
  const overrides = environment.featureOverrides as Record<string, 'mock' | 'local' | 'prod' | undefined>;
  let original: 'mock' | 'local' | 'prod' | undefined;

  beforeEach(() => { original = overrides['adopciones']; });
  afterEach(() => { overrides['adopciones'] = original; });

  it('es una fuente simulada', () => {
    expect(new FichasLocalesMockDataSource().fuenteSimulada).toBeTrue();
  });

  it('con adopciones en mock (todo-mock) conserva las 8 semillas', async () => {
    overrides['adopciones'] = 'mock';
    const lista = await firstValueFrom(new FichasLocalesMockDataSource().list());
    expect(lista.map((f) => f.id)).toEqual(['fl-1', 'fl-2', 'fl-3', 'fl-4', 'fl-5', 'fl-6', 'fl-7', 'fl-8']);
  });

  it('con adopciones reales arranca vacío, y sigue permitiendo crear y leer lo creado', async () => {
    overrides['adopciones'] = 'prod';
    const ds = new FichasLocalesMockDataSource();
    expect(await firstValueFrom(ds.list())).toEqual([]);
    expect(await codigoDeError(firstValueFrom(ds.getById('fl-1')))).toBe(4073);

    const creada = await firstValueFrom(ds.create(FORM));
    expect((await firstValueFrom(ds.list())).map((f) => f.id)).toEqual([creada.id]);
  });
});
