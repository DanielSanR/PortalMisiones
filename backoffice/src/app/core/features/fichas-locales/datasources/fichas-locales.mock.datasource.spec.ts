import { firstValueFrom } from 'rxjs';
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

  it('una transición inválida responde 5000 y no cambia nada', async () => {
    const creada = await firstValueFrom(ds.create(FORM));
    expect(await codigoDeError(firstValueFrom(ds.transicion(creada.id, 'publish')))).toBe(5000);
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

  it('ficha inexistente o campos NOT NULL faltantes → 5000', async () => {
    expect(await codigoDeError(firstValueFrom(ds.getById('no-existe')))).toBe(5000);
    expect(await codigoDeError(firstValueFrom(ds.create({ ...FORM, localidadId: '' })))).toBe(5000);
  });
});
