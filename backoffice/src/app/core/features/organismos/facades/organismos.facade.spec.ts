import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { TiposOrganismoRepository } from '@features/tipos-organismo';
import { LocalidadesRepository } from '@features/localidades';
import { OrganismosRepository } from '../repositories/organismos.repository';
import { OrganismoVM } from '../models/organismo.vm';
import { OrganismosFacade } from './organismos.facade';

/** `GET /api/organism-type` exige `READ_ORGANISM_TYPE`: sin él no se pide (un 403 abría el diálogo global). */
describe('OrganismosFacade — tipos según permiso', () => {
  let tipos: jasmine.SpyObj<TiposOrganismoRepository>;
  let permisos: string[];

  function crear(permisosDeSesion: string[]): OrganismosFacade {
    permisos = permisosDeSesion;
    tipos = jasmine.createSpyObj<TiposOrganismoRepository>('TiposOrganismoRepository', ['getOptions']);
    tipos.getOptions.and.returnValue(of([{ id: 'tp-1', nombre: 'Ministerio' }]));
    const repo = jasmine.createSpyObj<OrganismosRepository>('OrganismosRepository', ['list', 'getById']);
    repo.list.and.returnValue(of([{ id: 'o-1', nombre: 'Salud', typeId: 'tp-1', parentId: null }] as unknown as OrganismoVM[]));
    const localidades = jasmine.createSpyObj<LocalidadesRepository>('LocalidadesRepository', ['getLocalidades']);
    localidades.getLocalidades.and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        { provide: OrganismosRepository, useValue: repo },
        { provide: TiposOrganismoRepository, useValue: tipos },
        { provide: LocalidadesRepository, useValue: localidades },
        { provide: AuthTokenService, useValue: { can: (p: string) => permisos.includes(p) } },
      ],
    });
    return TestBed.inject(OrganismosFacade);
  }

  it('sin READ_ORGANISM_TYPE el listado carga sin pedir los tipos (la columna Tipo queda vacía)', async () => {
    const facade = crear(['READ_ORGANISM']);

    const [fila] = await firstValueFrom(facade.loadOrganismos());

    expect(tipos.getOptions).not.toHaveBeenCalled();
    expect(fila.tipoNombre).toBeUndefined();
  });

  it('sin READ_ORGANISM_TYPE el form carga sin pedir los tipos', async () => {
    const facade = crear(['READ_ORGANISM']);

    const datos = await firstValueFrom(facade.getFormData());

    expect(tipos.getOptions).not.toHaveBeenCalled();
    expect(datos.tipos).toEqual([]);
  });

  it('con READ_ORGANISM_TYPE nombra el tipo', async () => {
    const facade = crear(['READ_ORGANISM', 'READ_ORGANISM_TYPE']);

    const [fila] = await firstValueFrom(facade.loadOrganismos());

    expect(tipos.getOptions).toHaveBeenCalledTimes(1);
    expect(fila.tipoNombre).toBe('Ministerio');
  });
});
