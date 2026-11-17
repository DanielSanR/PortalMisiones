import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { PuntosAtencionMockDataSource } from './puntos-atencion.mock.datasource';
import { PuntoAtencionFormValue } from '../models/punto-atencion.vm';

const FORM: PuntoAtencionFormValue = {
  fichaId: 'f-1', nombre: 'Sede', direccion: 'Calle 1', contacto: '', horarios: '', latitud: -27.36, longitud: -55.89, activo: true,
};

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
