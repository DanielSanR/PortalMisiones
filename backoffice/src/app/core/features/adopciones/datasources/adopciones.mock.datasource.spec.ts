import { firstValueFrom } from 'rxjs';
import { AdopcionFormValue } from '../models/adopcion.vm';
import { AdopcionesMockDataSource } from './adopciones.mock.datasource';

type ErrorSimulado = { status?: number; error?: { code?: number } } | null;

const HOY = new Date();
const enDias = (n: number): Date => new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() + n);

const form = (extra: Partial<AdopcionFormValue> = {}): AdopcionFormValue => ({
  plantillaId: 'pt-1', organismoId: 'org-2', organismoTitularId: null, habilitada: true,
  vigenteDesde: enDias(0), vigenteHasta: null,
  ...extra,
});

const rechazo = (pedido: Promise<unknown>): Promise<ErrorSimulado> => pedido.then(() => null, (e: unknown) => e as ErrorSimulado);

/** Mismos códigos Y status HTTP que `OrganismProcedureService` (backend `dev` @ `586b670`). */
describe('AdopcionesMockDataSource — errores con el status del backend', () => {
  let ds: AdopcionesMockDataSource;

  beforeEach(() => {
    ds = new AdopcionesMockDataSource();
  });

  it('solapamiento con otra adopción habilitada de la misma plantilla y organismo → 409 con código 4080', async () => {
    // La semilla ya tiene `pt-1` + `org-2` vigente y sin fin.
    const err = await rechazo(firstValueFrom(ds.create(form())));

    expect(err?.status).toBe(409);
    expect(err?.error?.code).toBe(4080);
  });

  it('el solapamiento también se rechaza con 409 al editar', async () => {
    const otra = await firstValueFrom(ds.create(form({ plantillaId: 'pt-2', organismoId: 'org-2' })));

    const err = await rechazo(firstValueFrom(ds.update(otra.id, form())));

    expect(err?.status).toBe(409);
    expect(err?.error?.code).toBe(4080);
  });

  it('fin que no es posterior al inicio → 400 con código 4012', async () => {
    const err = await rechazo(firstValueFrom(ds.create(form({ plantillaId: 'pt-2', vigenteDesde: enDias(10), vigenteHasta: enDias(5) }))));

    expect(err?.status).toBe(400);
    expect(err?.error?.code).toBe(4012);
  });

  it('adopción inexistente → 404 con código 4073', async () => {
    const err = await rechazo(firstValueFrom(ds.getById('no-existe')));

    expect(err?.status).toBe(404);
    expect(err?.error?.code).toBe(4073);
  });
});
