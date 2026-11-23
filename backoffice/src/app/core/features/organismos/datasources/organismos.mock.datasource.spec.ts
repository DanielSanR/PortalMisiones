import { firstValueFrom } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { OrganismosMockDataSource } from './organismos.mock.datasource';

type Rechazo = { status?: number; error?: { code?: number } } | null;
const rechazo = (pedido: Promise<unknown>): Promise<Rechazo> => pedido.then(() => null, (e: unknown) => e as Rechazo);

/** Mismo contrato que `OrganismService.getOrganism` del backend. */
describe('OrganismosMockDataSource', () => {
  it('un organismo que no existe falla como el backend: 404 con código 4058', async () => {
    const err = await rechazo(firstValueFrom(new OrganismosMockDataSource().getById('no-existe')));

    expect(err?.status).toBe(404);
    expect(err?.error?.code).toBe(API_CODES.ORGANISM_NOT_FOUND);
  });

  it('uno que existe se lee', async () => {
    const ds = new OrganismosMockDataSource();
    const [primero] = await firstValueFrom(ds.list());

    expect((await firstValueFrom(ds.getById(primero.id))).nombre).toBe(primero.nombre);
  });
});
