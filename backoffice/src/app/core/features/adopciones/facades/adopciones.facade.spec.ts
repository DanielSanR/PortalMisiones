import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { OrganismoDeSesion } from '@core/models/auth.model';
import { PlantillaVM, PlantillasRepository } from '@features/plantillas';
import { OrganismoVM, OrganismosRepository } from '@features/organismos';
import { AdopcionesRepository } from '../repositories/adopciones.repository';
import { Adopcion } from '../models/adopcion.vm';
import { AdopcionesFacade } from './adopciones.facade';

const IPS: OrganismoDeSesion = { id: 'org-1', nombre: 'Instituto de Previsión Social', sigla: 'IPS' };
const ADOPCION: Adopcion = {
  id: 'a-1', plantillaId: 'pt-1', organismoId: 'org-1', organismoTitularId: null, habilitada: true,
  vigenteDesde: new Date(2026, 0, 1), vigenteHasta: null,
};

/** Organismo de la sesión (`/api/auth/me`, backend `586b670`, G-2) en "Trámites del organismo". */
describe('AdopcionesFacade — organismo de la sesión', () => {
  let organismos: jasmine.SpyObj<OrganismosRepository>;
  let plantillas: jasmine.SpyObj<PlantillasRepository>;

  function crear(sesion: { organismo: OrganismoDeSesion | null; permisos: string[] }): AdopcionesFacade {
    organismos = jasmine.createSpyObj<OrganismosRepository>('OrganismosRepository', ['getOptions', 'list']);
    organismos.getOptions.and.returnValue(of([{ id: 'org-2', nombre: 'Rentas' }, { id: 'org-1', nombre: 'IPS' }]));
    organismos.list.and.returnValue(of([]));
    plantillas = jasmine.createSpyObj<PlantillasRepository>('PlantillasRepository', ['list', 'getById']);
    plantillas.list.and.returnValue(of([
      { id: 'pt-1', titulo: 'Obtener el carnet', activa: true },
      { id: 'pt-2', titulo: 'Desactivada', activa: false },
    ] as PlantillaVM[]));
    const adopciones = jasmine.createSpyObj<AdopcionesRepository>('AdopcionesRepository', ['list']);
    adopciones.list.and.returnValue(of([ADOPCION]));

    TestBed.configureTestingModule({
      providers: [
        { provide: AdopcionesRepository, useValue: adopciones },
        { provide: PlantillasRepository, useValue: plantillas },
        { provide: OrganismosRepository, useValue: organismos },
        {
          provide: AuthTokenService,
          useValue: {
            getCurrentUser$: () => of(null),
            can: (permiso: string) => sesion.permisos.includes(permiso),
            getUserOrganismo: () => sesion.organismo,
            getUserOrganismoId: () => sesion.organismo?.id ?? null,
          },
        },
      ],
    });
    return TestBed.inject(AdopcionesFacade);
  }

  describe('opciones de "Adoptar trámite"', () => {
    it('sesión de organismo sin READ_ORGANISM: no pide /api/organism y fija el organismo de la sesión', async () => {
      const facade = crear({ organismo: IPS, permisos: ['READ_PROCEDURE', 'CREATE_ADOPTION'] });

      const opciones = await firstValueFrom(facade.getOpcionesAdoptar());

      expect(organismos.getOptions).not.toHaveBeenCalled();
      expect(opciones.organismos).toEqual([{ id: 'org-1', nombre: 'Instituto de Previsión Social (IPS)' }]);
      expect(opciones.organismoFijo).toEqual({
        id: 'org-1', nombre: 'Instituto de Previsión Social (IPS)',
        motivo: 'Tu cuenta pertenece a Instituto de Previsión Social (IPS): solo podés adoptar trámites para ese organismo.',
      });
      expect(opciones.plantillas).toEqual([{ id: 'pt-1', nombre: 'Obtener el carnet' }]);
    });

    it('sesión de organismo CON READ_ORGANISM: igual manda el suyo (el backend rechaza cualquier otro)', async () => {
      const facade = crear({ organismo: IPS, permisos: ['READ_PROCEDURE', 'READ_ORGANISM'] });

      const opciones = await firstValueFrom(facade.getOpcionesAdoptar());

      expect(organismos.getOptions).not.toHaveBeenCalled();
      expect(opciones.organismoFijo?.id).toBe('org-1');
    });

    it('sesión global con READ_ORGANISM (o backend sin G-2): elige del catálogo, ordenado, sin nada fijo', async () => {
      const facade = crear({ organismo: null, permisos: ['READ_PROCEDURE', 'READ_ORGANISM'] });

      const opciones = await firstValueFrom(facade.getOpcionesAdoptar());

      expect(organismos.getOptions).toHaveBeenCalledTimes(1);
      expect(opciones.organismos.map((o) => o.nombre)).toEqual(['IPS', 'Rentas']);
      expect(opciones.organismoFijo).toBeNull();
    });

    it('sin organismo en la sesión ni READ_ORGANISM: sin opciones y sin pedir el catálogo (como antes)', async () => {
      const facade = crear({ organismo: null, permisos: ['READ_PROCEDURE'] });

      const opciones = await firstValueFrom(facade.getOpcionesAdoptar());

      expect(organismos.getOptions).not.toHaveBeenCalled();
      expect(opciones.organismos).toEqual([]);
      expect(opciones.organismoFijo).toBeNull();
    });
  });

  describe('nombre del organismo en el listado', () => {
    it('sin READ_ORGANISM, el organismo propio se nombra con la sesión en vez de quedar "no disponible"', async () => {
      const facade = crear({ organismo: IPS, permisos: ['READ_PROCEDURE'] });

      const [fila] = await firstValueFrom(facade.loadAdopciones());

      expect(organismos.list).not.toHaveBeenCalled();
      expect(fila.organismoNombre).toBe('Instituto de Previsión Social (IPS)');
      expect(fila.plantillaTitulo).toBe('Obtener el carnet');
    });

    it('el listado y el diálogo "Adoptar trámite" nombran el organismo propio igual ("Nombre (SIGLA)")', async () => {
      const facade = crear({ organismo: IPS, permisos: ['READ_PROCEDURE'] });

      const [fila] = await firstValueFrom(facade.loadAdopciones());
      const opciones = await firstValueFrom(facade.getOpcionesAdoptar());

      expect(fila.organismoNombre).toBe(opciones.organismoFijo?.nombre ?? null);
      expect(fila.organismoNombre).toBe(opciones.organismos[0].nombre);
    });

    it('con READ_ORGANISM también: el organismo propio lleva la etiqueta de la sesión, no el nombre del catálogo', async () => {
      const facade = crear({ organismo: IPS, permisos: ['READ_PROCEDURE', 'READ_ORGANISM'] });
      organismos.list.and.returnValue(of([{ id: 'org-1', nombre: 'IPS (catálogo)' }, { id: 'org-2', nombre: 'Rentas' }] as OrganismoVM[]));

      const [fila] = await firstValueFrom(facade.loadAdopciones());

      expect(fila.organismoNombre).toBe('Instituto de Previsión Social (IPS)');
    });

    it('sin organismo en la sesión ni READ_ORGANISM, el nombre sigue sin resolverse (como antes)', async () => {
      const facade = crear({ organismo: null, permisos: ['READ_PROCEDURE'] });

      const [fila] = await firstValueFrom(facade.loadAdopciones());

      expect(fila.organismoNombre).toBeNull();
    });
  });
});
