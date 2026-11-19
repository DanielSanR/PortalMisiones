import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { AuthUser, OrganismoDeSesion } from '@core/models/auth.model';
import { OrganismosRepository } from '@features/organismos';
import { EtiquetasRepository } from '../repositories/etiquetas.repository';
import { EtiquetaVM } from '../models/etiqueta.vm';
import { EtiquetasFacade } from './etiquetas.facade';

const IPS: OrganismoDeSesion = { id: 'org-1', nombre: 'Instituto de Previsión Social', sigla: 'IPS' };
const LOCAL: EtiquetaVM = { id: 't-1', slug: 'jubilaciones', organismoId: 'org-1', organismoNombre: null, local: true };

/** Organismo de la sesión (`/api/auth/me`, backend `586b670`, G-2 / BO-20) en Etiquetas. */
describe('EtiquetasFacade — organismo de la sesión', () => {
  let organismos: jasmine.SpyObj<OrganismosRepository>;
  /** Sesión reactiva (`getCurrentUser$`): de acá sale `soloEtiquetasLocales$`. */
  let usuario$: BehaviorSubject<AuthUser | null>;

  const usuario = (extra: Partial<AuthUser>): AuthUser => ({
    id: 'u-1', email: 'ana@misiones.gob.ar', nombre: '', apellido: '', role: null, roles: [], roleCodes: [], permissions: [],
    ...extra,
  });
  const DE_ORGANISMO = usuario({ scope: 'organismo', organismoId: 'org-1', organismoNombre: 'Instituto de Previsión Social', organismoSigla: 'IPS' });
  const GLOBAL = usuario({ scope: 'global', organismoId: null });

  beforeEach(() => { usuario$ = new BehaviorSubject<AuthUser | null>(null); });

  function crear(sesion: { organismo: OrganismoDeSesion | null; leeOrganismos: boolean }): EtiquetasFacade {
    organismos = jasmine.createSpyObj<OrganismosRepository>('OrganismosRepository', ['getOptions']);
    organismos.getOptions.and.returnValue(of([{ id: 'org-1', nombre: 'IPS' }, { id: 'org-2', nombre: 'Rentas' }]));
    const etiquetas = jasmine.createSpyObj<EtiquetasRepository>('EtiquetasRepository', ['list', 'getById']);
    etiquetas.list.and.returnValue(of([LOCAL]));
    etiquetas.getById.and.returnValue(of(LOCAL));

    TestBed.configureTestingModule({
      providers: [
        { provide: EtiquetasRepository, useValue: etiquetas },
        { provide: OrganismosRepository, useValue: organismos },
        {
          provide: AuthTokenService,
          useValue: {
            can: () => sesion.leeOrganismos,
            getUserOrganismo: () => sesion.organismo,
            getCurrentUser$: () => usuario$.asObservable(),
          },
        },
      ],
    });
    return TestBed.inject(EtiquetasFacade);
  }

  it('sesión de organismo sin READ_ORGANISM: el form recibe su organismo fijo, sin pedir /api/organism', async () => {
    const facade = crear({ organismo: IPS, leeOrganismos: false });

    const datos = await firstValueFrom(facade.getFormData(null));

    expect(organismos.getOptions).not.toHaveBeenCalled();
    expect(datos.organismos).toEqual([{ id: 'org-1', nombre: 'Instituto de Previsión Social (IPS)' }]);
    expect(datos.organismoFijo).toEqual({
      id: 'org-1', nombre: 'Instituto de Previsión Social (IPS)',
      motivo: 'Tu cuenta pertenece a Instituto de Previsión Social (IPS): las etiquetas que crees son locales de ese organismo.',
    });
  });

  it('sesión de organismo: la lista nombra el organismo de sus etiquetas locales con la sesión', async () => {
    const facade = crear({ organismo: IPS, leeOrganismos: false });

    const [fila] = await firstValueFrom(facade.loadEtiquetas());

    expect(fila.organismoNombre).toBe('Instituto de Previsión Social (IPS)');
  });

  it('sesión global con READ_ORGANISM: catálogo completo y nada fijo', async () => {
    const facade = crear({ organismo: null, leeOrganismos: true });

    const datos = await firstValueFrom(facade.getFormData(null));

    expect(organismos.getOptions).toHaveBeenCalledTimes(1);
    expect(datos.organismos.length).toBe(2);
    expect(datos.organismoFijo).toBeNull();
  });

  it('sin organismo en la sesión ni READ_ORGANISM (backend sin G-2): como antes, sin opciones y sin pedir el catálogo', async () => {
    const facade = crear({ organismo: null, leeOrganismos: false });

    const datos = await firstValueFrom(facade.getFormData('t-1'));

    expect(organismos.getOptions).not.toHaveBeenCalled();
    expect(datos.organismos).toEqual([]);
    expect(datos.organismoFijo).toBeNull();
    expect(datos.etiqueta?.organismoNombre).toBeNull();
  });

  /** Con alcance de organismo `GET /api/tag` solo trae las etiquetas de ese organismo: no hay globales que filtrar. */
  describe('soloEtiquetasLocales$ (la lista oculta el filtro Global/Local)', () => {
    it('sesión de organismo: `true`', async () => {
      usuario$.next(DE_ORGANISMO);
      const facade = crear({ organismo: IPS, leeOrganismos: false });

      expect(await firstValueFrom(facade.soloEtiquetasLocales$)).toBeTrue();
    });

    it('sesión global, backend sin G-2 (sin scope ni organismo) o sin sesión: `false`', async () => {
      const facade = crear({ organismo: null, leeOrganismos: true });

      usuario$.next(GLOBAL);
      expect(await firstValueFrom(facade.soloEtiquetasLocales$)).toBeFalse();
      usuario$.next(usuario({}));
      expect(await firstValueFrom(facade.soloEtiquetasLocales$)).toBeFalse();
      usuario$.next(null);
      expect(await firstValueFrom(facade.soloEtiquetasLocales$)).toBeFalse();
    });

    it('sigue a la sesión y no repite el mismo valor', () => {
      const facade = crear({ organismo: null, leeOrganismos: true });
      const vistos: boolean[] = [];
      const sub = facade.soloEtiquetasLocales$.subscribe((valor) => vistos.push(valor));

      usuario$.next(GLOBAL);
      usuario$.next(DE_ORGANISMO);
      usuario$.next({ ...DE_ORGANISMO, permissions: ['READ_TAG'] });
      usuario$.next(GLOBAL);
      sub.unsubscribe();

      expect(vistos).toEqual([false, true, false]);
    });
  });
});
