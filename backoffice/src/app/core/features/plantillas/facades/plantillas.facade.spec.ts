import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { ModalidadVM, ModalidadesRepository } from '@features/modalidades';
import { CategoriasRepository } from '@features/categorias';
import { EtiquetaVM, EtiquetasRepository } from '@features/etiquetas';
import { DestinatariosRepository } from '@features/destinatarios';
import { EventosDeVidaRepository } from '@features/eventos-de-vida';
import { PlantillasRepository } from '../repositories/plantillas.repository';
import { PlantillaVM } from '../models/plantilla.vm';
import { PlantillasFacade } from './plantillas.facade';

const PLANTILLA = {
  id: 'pt-1', titulo: 'Obtener el carnet', activa: true,
  modalidad: { id: 'm-1', nombre: null }, categoriaPrincipal: null, categorias: [],
  etiquetas: [{ id: 't-1', nombre: null }], destinatarios: [], eventosDeVida: [],
} as unknown as PlantillaVM;

/** Catálogos de la plantilla según los permisos de la sesión (un 403 de `/api/tag` abría el diálogo global). */
describe('PlantillasFacade — catálogos y permisos', () => {
  let etiquetas: jasmine.SpyObj<EtiquetasRepository>;
  let modalidades: jasmine.SpyObj<ModalidadesRepository>;
  let permisos: string[];

  function crear(permisosDeSesion: string[]): PlantillasFacade {
    permisos = permisosDeSesion;
    etiquetas = jasmine.createSpyObj<EtiquetasRepository>('EtiquetasRepository', ['list']);
    etiquetas.list.and.returnValue(of([{ id: 't-1', slug: 'salud', local: false }] as unknown as EtiquetaVM[]));
    modalidades = jasmine.createSpyObj<ModalidadesRepository>('ModalidadesRepository', ['list']);
    modalidades.list.and.returnValue(of([{ id: 'm-1', nombre: 'Presencial', activo: true }] as unknown as ModalidadVM[]));
    const categorias = jasmine.createSpyObj<CategoriasRepository>('CategoriasRepository', ['list']);
    categorias.list.and.returnValue(of([]));
    const destinatarios = jasmine.createSpyObj<DestinatariosRepository>('DestinatariosRepository', ['list']);
    destinatarios.list.and.returnValue(of([]));
    const eventos = jasmine.createSpyObj<EventosDeVidaRepository>('EventosDeVidaRepository', ['list']);
    eventos.list.and.returnValue(of([]));
    const plantillas = jasmine.createSpyObj<PlantillasRepository>('PlantillasRepository', ['list', 'getById']);
    plantillas.list.and.returnValue(of([PLANTILLA]));
    plantillas.getById.and.returnValue(of(PLANTILLA));

    TestBed.configureTestingModule({
      providers: [
        { provide: PlantillasRepository, useValue: plantillas },
        { provide: ModalidadesRepository, useValue: modalidades },
        { provide: CategoriasRepository, useValue: categorias },
        { provide: EtiquetasRepository, useValue: etiquetas },
        { provide: DestinatariosRepository, useValue: destinatarios },
        { provide: EventosDeVidaRepository, useValue: eventos },
        { provide: AuthTokenService, useValue: { can: (p: string) => permisos.includes(p) } },
      ],
    });
    return TestBed.inject(PlantillasFacade);
  }

  it('sin READ_TAG no pide /api/tag: el listado carga y las etiquetas quedan sin nombre', async () => {
    const facade = crear(['READ_PROCEDURE']);

    const [fila] = await firstValueFrom(facade.loadPlantillas());

    expect(etiquetas.list).not.toHaveBeenCalled();
    expect(fila.etiquetas).toEqual([{ id: 't-1', nombre: null }]);
    expect(fila.modalidad).toEqual({ id: 'm-1', nombre: 'Presencial' });
  });

  it('sin READ_TAG el form marca las etiquetas como no disponibles, sin pedirlas', async () => {
    const facade = crear(['READ_PROCEDURE']);

    const { catalogos } = await firstValueFrom(facade.getFormData(null));

    expect(etiquetas.list).not.toHaveBeenCalled();
    expect(catalogos.noDisponibles).toEqual(['Etiquetas']);
    expect(catalogos.etiquetas).toEqual([]);
    expect(catalogos.modalidades.length).toBe(1);
  });

  it('sin READ_TAG no reintenta los catálogos en cada uso (reintentar no cambia el permiso)', async () => {
    const facade = crear(['READ_PROCEDURE']);

    await firstValueFrom(facade.getFormData(null));
    await firstValueFrom(facade.getFormData(null));

    expect(modalidades.list).toHaveBeenCalledTimes(1);
  });

  it('con READ_TAG pide las etiquetas y las nombra', async () => {
    const facade = crear(['READ_PROCEDURE', 'READ_TAG']);

    const detalle = await firstValueFrom(facade.getDetalle('pt-1'));

    expect(etiquetas.list).toHaveBeenCalledTimes(1);
    expect(detalle.etiquetas).toEqual([{ id: 't-1', nombre: 'salud' }]);
  });

  it('modalidades, categorías, destinatarios y eventos de vida son públicos: se piden sin ningún permiso', async () => {
    const facade = crear([]);

    const { catalogos } = await firstValueFrom(facade.getFormData(null));

    expect(modalidades.list).toHaveBeenCalledTimes(1);
    expect(catalogos.noDisponibles).toEqual(['Etiquetas']);
  });

  it('si cambian los permisos de la sesión, la caché se rearma', async () => {
    const facade = crear(['READ_PROCEDURE']);
    await firstValueFrom(facade.getFormData(null));

    permisos.push('READ_TAG');
    const { catalogos } = await firstValueFrom(facade.getFormData(null));

    expect(etiquetas.list).toHaveBeenCalledTimes(1);
    expect(catalogos.noDisponibles).toEqual([]);
  });

  it('un fallo de red en un catálogo no tumba la pantalla y se reintenta en el próximo uso', async () => {
    const facade = crear(['READ_PROCEDURE', 'READ_TAG']);
    etiquetas.list.and.returnValues(throwError(() => new Error('500')), of([]));

    const primero = await firstValueFrom(facade.getFormData(null));
    const segundo = await firstValueFrom(facade.getFormData(null));

    expect(primero.catalogos.noDisponibles).toEqual(['Etiquetas']);
    expect(segundo.catalogos.noDisponibles).toEqual([]);
    expect(etiquetas.list).toHaveBeenCalledTimes(2);
  });
});
