import { firstValueFrom } from 'rxjs';
import { ProcedureTemplateRequestDTO } from '../models/plantilla.dto';
import { PlantillaFormValue } from '../models/plantilla.vm';
import { PlantillasMockDataSource } from './plantillas.mock.datasource';

const form = (extra: Partial<PlantillaFormValue> = {}): PlantillaFormValue => ({
  titulo: 'Renovar el carnet', slug: 'renovar-el-carnet', resumen: '', descripcionLarga: '', modalidadId: null,
  categoriaPrincipalId: null, categoriaIds: [], etiquetaIds: [], destinatarioIds: [], eventoDeVidaIds: [], activa: true,
  ...extra,
});

/** Request tal como viajaría al backend, SIN pasar por el mapper del front (que ya canonicaliza el slug). */
const request = (extra: Partial<ProcedureTemplateRequestDTO> = {}): ProcedureTemplateRequestDTO => ({
  slugBase: 'renovar-el-carnet', titleBase: 'Renovar el carnet', shortDescription: null, longDescription: null,
  modalityId: null, mainCategoryId: null, categoryIds: [], tagIds: [], lifeEventIds: [], recipientIds: [], active: true,
  ...extra,
});

type Rechazo = { status?: number; error?: { code?: number } } | null;
const rechazo = (pedido: Promise<unknown>): Promise<Rechazo> => pedido.then(() => null, (e: unknown) => e as Rechazo);

/** Mismo contrato que `ProcedureTemplateService` (backend `dev` @ `586b670`). */
describe('PlantillasMockDataSource', () => {
  let ds: PlantillasMockDataSource;

  beforeEach(() => {
    ds = new PlantillasMockDataSource();
  });

  it('devuelve el slug canónico, no el enviado (lo que la pantalla muestra tras guardar)', async () => {
    const creada = await firstValueFrom(ds.create(form({ slug: '  Renovar el Carné — 2026! ' })));
    expect(creada.slug).toBe('renovar-el-carne-2026');

    const editada = await firstValueFrom(ds.update(creada.id, form({ slug: 'RENOVACIÓN/Carné' })));
    expect(editada.slug).toBe('renovacion-carne');
    expect((await firstValueFrom(ds.getById(creada.id))).slug).toBe('renovacion-carne');
  });

  it('slug repetido → 409 con código 4072 (antes 400), también si solo difiere en tildes o mayúsculas', async () => {
    const [existente] = await firstValueFrom(ds.list());
    const err = await firstValueFrom(ds.create(form({ slug: existente.slug.toUpperCase() })))
      .then(() => null, (e: unknown) => e as { status?: number; error?: { code?: number } });

    expect(err?.status).toBe(409);
    expect(err?.error?.code).toBe(4072);
  });

  /**
   * El que canonicaliza es el SERVIDOR (`ProcedureTemplateService.canonicalize`): estas pruebas le hablan al
   * mock con el request crudo, sin el mapper del front, que es lo único que antes las hacía pasar.
   */
  describe('el "servidor" simulado canonicaliza el slug que recibe (`post` / `put`)', () => {
    it('`post` guarda y devuelve el slug canónico aunque llegue sin normalizar', async () => {
      const creada = await firstValueFrom(ds.post(request({ slugBase: '  Renovar el Carné — 2026! ' })));

      expect(creada.slugBase).toBe('renovar-el-carne-2026');
      expect((await firstValueFrom(ds.getById(creada.id))).slug).toBe('renovar-el-carne-2026');
    });

    it('`put` guarda y devuelve el slug canónico aunque llegue sin normalizar', async () => {
      const creada = await firstValueFrom(ds.post(request()));

      const editada = await firstValueFrom(ds.put(creada.id, request({ slugBase: 'RENOVACIÓN/Carné' })));

      expect(editada.slugBase).toBe('renovacion-carne');
      expect((await firstValueFrom(ds.getById(creada.id))).slug).toBe('renovacion-carne');
    });

    it('`post` con un slug que solo difiere en tildes, mayúsculas o separadores → 409 con código 4072', async () => {
      // Semilla: `obtener-licencia-de-conducir`.
      const err = await rechazo(firstValueFrom(ds.post(request({ slugBase: 'Obtener  LICENCIA de Condúcir!' }))));

      expect(err?.status).toBe(409);
      expect(err?.error?.code).toBe(4072);
      expect((await firstValueFrom(ds.list())).length).toBe(3);
    });

    it('`put` hacia el slug de otra plantilla, escrito sin normalizar → 409 con código 4072', async () => {
      const creada = await firstValueFrom(ds.post(request()));

      const err = await rechazo(firstValueFrom(ds.put(creada.id, request({ slugBase: 'OBTENER_CARNET_SANITARIO' }))));

      expect(err?.status).toBe(409);
      expect(err?.error?.code).toBe(4072);
      expect((await firstValueFrom(ds.getById(creada.id))).slug).toBe('renovar-el-carnet');
    });

    it('`put` con su propio slug escrito sin normalizar no choca consigo misma', async () => {
      const creada = await firstValueFrom(ds.post(request()));

      const editada = await firstValueFrom(ds.put(creada.id, request({ slugBase: ' Renovar el Carnet ' })));

      expect(editada.slugBase).toBe('renovar-el-carnet');
    });

    it('`put` de una plantilla inexistente → 404 con código 4073', async () => {
      const err = await rechazo(firstValueFrom(ds.put('no-existe', request())));

      expect(err?.status).toBe(404);
      expect(err?.error?.code).toBe(4073);
    });
  });

  it('editar una plantilla conservando su propio slug no choca consigo misma', async () => {
    const [existente] = await firstValueFrom(ds.list());
    const editada = await firstValueFrom(ds.update(existente.id, form({ slug: existente.slug, titulo: 'Otro título' })));
    expect(editada.slug).toBe(existente.slug);
  });
});
