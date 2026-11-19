import { firstValueFrom } from 'rxjs';
import { EtiquetasMockDataSource } from './etiquetas.mock.datasource';

/** Código de negocio de un error del mock (`{ error: { code } }`). */
async function codigoDeError(promesa: Promise<unknown>): Promise<number | null> {
  try {
    await promesa;
    return null;
  } catch (err) {
    return (err as { error?: { code?: number } }).error?.code ?? null;
  }
}

describe('EtiquetasMockDataSource', () => {
  let ds: EtiquetasMockDataSource;

  beforeEach(() => {
    ds = new EtiquetasMockDataSource();
  });

  it('editar el slug conserva el organismo de la etiqueta', async () => {
    const [etiqueta] = await firstValueFrom(ds.list());
    const editada = await firstValueFrom(ds.update(etiqueta.id, { slug: 'Slug Nuevo', organismoId: etiqueta.organismoId }));
    expect(editada.slug).toBe('slug-nuevo');
    expect(editada.organismoId).toBe(etiqueta.organismoId);
    expect(editada.local).toBe(etiqueta.local);
  });

  it('cambiar de organismo al editar → 4072 y no modifica nada', async () => {
    const [etiqueta] = await firstValueFrom(ds.list());
    const otroOrganismo = etiqueta.organismoId === null ? 'org-otro' : null;
    expect(await codigoDeError(firstValueFrom(ds.update(etiqueta.id, { slug: 'otro-slug', organismoId: otroOrganismo })))).toBe(4072);
    expect(await firstValueFrom(ds.getById(etiqueta.id))).toEqual(etiqueta);
  });

  it('un duplicado responde 409 con 4072, como el backend 586b670 (antes 400)', async () => {
    const [etiqueta] = await firstValueFrom(ds.list());
    const err = await firstValueFrom(ds.create({ slug: etiqueta.slug.toUpperCase(), organismoId: etiqueta.organismoId }))
      .then(() => null, (e: unknown) => e as { status?: number; error?: { code?: number } });
    expect(err?.status).toBe(409);
    expect(err?.error?.code).toBe(4072);
  });

  it('eliminar una etiqueta inexistente → 4073', async () => {
    expect(await codigoDeError(firstValueFrom(ds.delete('no-existe')))).toBe(4073);
    const [etiqueta] = await firstValueFrom(ds.list());
    await firstValueFrom(ds.delete(etiqueta.id));
    expect(await codigoDeError(firstValueFrom(ds.getById(etiqueta.id)))).toBe(4073);
  });
});
