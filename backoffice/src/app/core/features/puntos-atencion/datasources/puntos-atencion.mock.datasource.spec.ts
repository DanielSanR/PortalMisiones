import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { PuntosAtencionMockDataSource } from './puntos-atencion.mock.datasource';
import { PuntoAtencionFormValue } from '../models/punto-atencion.vm';

const FORM: PuntoAtencionFormValue = {
  fichaId: 'f-1', nombre: 'Sede', direccion: 'Calle 1', contacto: '', horarios: '', latitud: -27.36, longitud: -55.89, activo: true,
};

describe('PuntosAtencionMockDataSource · filtro por ficha (?organismProcedureLocationId=)', () => {
  let ds: PuntosAtencionMockDataSource;

  beforeEach(() => { ds = new PuntosAtencionMockDataSource(); });

  it('sin filtro lista activos e inactivos de todas las fichas', async () => {
    const lista = await firstValueFrom(ds.list());
    expect(lista.length).toBe(6);
    expect(lista.some((p) => !p.activo)).toBeTrue();
  });

  it('con filtro devuelve solo los ACTIVOS de esa ficha, como el backend', async () => {
    // fl-1 tiene pa-1 (activo) y pa-2 (desactivado).
    const lista = await firstValueFrom(ds.list({ fichaId: 'fl-1' }));
    expect(lista.map((p) => p.id)).toEqual(['pa-1']);
  });

  it('un punto desactivado deja de venir en el filtro, y vuelve al reactivarlo', async () => {
    await firstValueFrom(ds.desactivar('pa-1'));
    expect(await firstValueFrom(ds.list({ fichaId: 'fl-1' }))).toEqual([]);

    const pa2 = (await firstValueFrom(ds.list())).find((p) => p.id === 'pa-2')!;
    await firstValueFrom(ds.update('pa-2', {
      fichaId: pa2.fichaId, nombre: pa2.nombre, direccion: pa2.direccion, contacto: pa2.contacto ?? '',
      horarios: pa2.horarios ?? '', latitud: pa2.latitud!, longitud: pa2.longitud!, activo: true,
    }));
    expect((await firstValueFrom(ds.list({ fichaId: 'fl-1' }))).map((p) => p.id)).toEqual(['pa-2']);
  });
});

describe('PuntosAtencionMockDataSource · semillas según la fuente de adopciones', () => {
  const overrides = environment.featureOverrides as Record<string, 'mock' | 'local' | 'prod' | undefined>;
  let original: 'mock' | 'local' | 'prod' | undefined;

  beforeEach(() => { original = overrides['adopciones']; });
  afterEach(() => { overrides['adopciones'] = original; });

  it('es una fuente simulada', () => {
    expect(new PuntosAtencionMockDataSource().fuenteSimulada).toBeTrue();
  });

  it('con adopciones en mock (todo-mock) conserva las semillas', async () => {
    overrides['adopciones'] = 'mock';
    const lista = await firstValueFrom(new PuntosAtencionMockDataSource().list());
    expect(lista.length).toBe(6);
  });

  it('con adopciones reales arranca vacío (sus fichas semilla no existen) y permite crear', async () => {
    overrides['adopciones'] = 'prod';
    const ds = new PuntosAtencionMockDataSource();
    expect(await firstValueFrom(ds.list())).toEqual([]);
    const creado = await firstValueFrom(ds.create(FORM));
    expect((await firstValueFrom(ds.list())).map((p) => p.id)).toEqual([creado.id]);
  });
});
