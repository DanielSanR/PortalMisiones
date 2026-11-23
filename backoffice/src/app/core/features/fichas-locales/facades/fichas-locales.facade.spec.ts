import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject, defer, finalize, firstValueFrom, of, throwError } from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { AdopcionesRepository } from '@features/adopciones';
import { PlantillasRepository } from '@features/plantillas';
import { OrganismosRepository } from '@features/organismos';
import { LocalidadVM, LocalidadesRepository } from '@features/localidades';
import { FichasLocalesRepository } from '../repositories/fichas-locales.repository';
import { FichaLocal } from '../models/ficha-local.vm';
import { DespublicacionFallidaError, FichaCambiadaError, FichaSinContenidoError } from '../domain/ficha-errores';
import { FichasLocalesFacade } from './fichas-locales.facade';

const LOCALIDADES: LocalidadVM[] = [
  { id: 'loc-posadas', nombre: 'Posadas', departamentoId: 'd-1', departamentoNombre: 'Capital' },
  { id: 'loc-garupa', nombre: 'Garupá', departamentoId: 'd-1', departamentoNombre: 'Capital' },
];

import { FichasLocalesFiltro } from '../models/ficha-local.dto';

function ficha(id: string, adopcionId: string, localidadId: string, activa = true): FichaLocal {
  return {
    id, slug: `slug-${id}`, estado: 'BORRADOR', activa, version: 1,
    adopcionId, localidadId, url: null, requisitos: 'DNI', costos: null,
  };
}

const AHORA = Date.now();
const DIA = 24 * 60 * 60 * 1000;

interface OpcionesFacade {
  permisos?: string[];
  /** Adopción que devuelve `AdopcionesRepository.getById`; `null` = falla. */
  adopcion?: object | null;
}

/** Filtros con los que se pidió el listado de fichas en el test en curso. */
let filtros: Array<FichasLocalesFiltro | undefined> = [];

function facadeCon(lista: FichaLocal[], { permisos = [], adopcion = null }: OpcionesFacade = {}): FichasLocalesFacade {
  filtros = [];
  const auth = {
    getCurrentUser$: () => new BehaviorSubject({ id: 'u-1' }).asObservable(),
    // Por defecto sin permisos de catálogos: el facade no pide adopciones, plantillas ni organismos.
    can: (p: string) => permisos.includes(p),
  };
  const repo = {
    // Como la fuente real: `?organismProcedureId=` filtra en el servidor.
    list: (filtro?: FichasLocalesFiltro) => {
      filtros.push(filtro);
      return of(filtro?.adopcionId ? lista.filter((f) => f.adopcionId === filtro.adopcionId) : lista);
    },
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: FichasLocalesRepository, useValue: repo },
      {
        provide: AdopcionesRepository,
        useValue: {
          list: () => of([]),
          getById: () => (adopcion ? of(adopcion) : throwError(() => ({ status: 404 }))),
        },
      },
      { provide: PlantillasRepository, useValue: {} },
      { provide: OrganismosRepository, useValue: {} },
      { provide: LocalidadesRepository, useValue: { getLocalidades: () => of(LOCALIDADES) } },
      { provide: AuthTokenService, useValue: auth },
    ],
  });
  return TestBed.inject(FichasLocalesFacade);
}

const adopcionCon = (extra: object = {}) => ({
  id: 'op-1', plantillaId: 'p-1', organismoId: 'o-1', organismoTitularId: null, habilitada: true,
  vigenteDesde: new Date(AHORA - DIA), vigenteHasta: null, ...extra,
});

describe('FichasLocalesFacade · fichas de una adopción', () => {
  it('pide el listado con el filtro de la adopción y resuelve la localidad', async () => {
    const facade = facadeCon([ficha('f-1', 'op-1', 'loc-posadas'), ficha('f-2', 'op-2', 'loc-garupa')]);
    const resultado = await firstValueFrom(facade.getDeAdopcion('op-1'));
    expect(filtros).toEqual([{ adopcionId: 'op-1' }]);
    expect(resultado.fichas.map((f) => f.id)).toEqual(['f-1']);
    expect(resultado.fichas[0].localidadNombre).toBe('Posadas');
  });

  it('vuelve a filtrar por adopción en el cliente: si el servidor ignora el filtro y devuelve todo el alcance, no se cuelan fichas ajenas', async () => {
    const todas = [ficha('f-1', 'op-1', 'loc-posadas'), ficha('f-2', 'op-2', 'loc-garupa')];
    TestBed.configureTestingModule({
      providers: [
        // Backend que ignora `?organismProcedureId=`.
        { provide: FichasLocalesRepository, useValue: { list: () => of(todas) } },
        { provide: AdopcionesRepository, useValue: {} },
        { provide: PlantillasRepository, useValue: {} },
        { provide: OrganismosRepository, useValue: {} },
        { provide: LocalidadesRepository, useValue: { getLocalidades: () => of(LOCALIDADES) } },
        { provide: AuthTokenService, useValue: { getCurrentUser$: () => of({ id: 'u-1' }), can: () => false } },
      ],
    });
    const resultado = await firstValueFrom(TestBed.inject(FichasLocalesFacade).getDeAdopcion('op-1'));
    expect(resultado.fichas.map((f) => f.id)).toEqual(['f-1']);
    expect(resultado.sinContenido).toBeFalse();
  });

  it('backend viejo (fichas sin su adopción): no lista ninguna y lo dice con sinContenido, en vez de un vacío mudo', async () => {
    const viejas: FichaLocal[] = [
      { ...ficha('f-1', '', ''), sinContenido: true },
      { ...ficha('f-2', '', ''), sinContenido: true },
    ];
    TestBed.configureTestingModule({
      providers: [
        { provide: FichasLocalesRepository, useValue: { list: () => of(viejas) } },
        { provide: AdopcionesRepository, useValue: {} },
        { provide: PlantillasRepository, useValue: {} },
        { provide: OrganismosRepository, useValue: {} },
        { provide: LocalidadesRepository, useValue: { getLocalidades: () => of(LOCALIDADES) } },
        { provide: AuthTokenService, useValue: { getCurrentUser$: () => of({ id: 'u-1' }), can: () => false } },
      ],
    });
    const resultado = await firstValueFrom(TestBed.inject(FichasLocalesFacade).getDeAdopcion('op-1'));
    expect(resultado.fichas).toEqual([]);
    expect(resultado.sinContenido).toBeTrue();
  });

  it('trae también las desactivadas, y una adopción sin fichas es un vacío real', async () => {
    const facade = facadeCon([ficha('f-1', 'op-1', 'loc-posadas', false)]);
    expect((await firstValueFrom(facade.getDeAdopcion('op-1'))).fichas.map((f) => f.activa)).toEqual([false]);
    expect((await firstValueFrom(facade.getDeAdopcion('op-9'))).fichas).toEqual([]);
  });

  it('sin READ_ADOPTION no lee la adopción: la vigencia queda sin decidir (null)', async () => {
    const resultado = await firstValueFrom(facadeCon([], { adopcion: adopcionCon({ habilitada: false }) }).getDeAdopcion('op-1'));
    expect(resultado.motivoNoVigente).toBeNull();
  });

  it('con la adopción vigente no hay motivo', async () => {
    const facade = facadeCon([], { permisos: ['READ_ADOPTION'], adopcion: adopcionCon() });
    expect((await firstValueFrom(facade.getDeAdopcion('op-1'))).motivoNoVigente).toBeNull();
  });

  it('dice por qué no se le pueden agregar fichas: deshabilitada, programada o vencida', async () => {
    const casos: Array<[object, string]> = [
      [{ habilitada: false }, 'deshabilitada'],
      [{ vigenteDesde: new Date(AHORA + DIA) }, 'programada'],
      [{ vigenteDesde: new Date(AHORA - 2 * DIA), vigenteHasta: new Date(AHORA - DIA) }, 'vencida'],
    ];
    for (const [extra, motivo] of casos) {
      TestBed.resetTestingModule();
      const facade = facadeCon([], { permisos: ['READ_ADOPTION'], adopcion: adopcionCon(extra) });
      expect((await firstValueFrom(facade.getDeAdopcion('op-1'))).motivoNoVigente as string).toBe(motivo);
    }
  });

  it('si la adopción no se puede leer, igual devuelve las fichas', async () => {
    const facade = facadeCon([ficha('f-1', 'op-1', 'loc-posadas')], { permisos: ['READ_ADOPTION'], adopcion: null });
    const resultado = await firstValueFrom(facade.getDeAdopcion('op-1'));
    expect(resultado.fichas.length).toBe(1);
    expect(resultado.motivoNoVigente).toBeNull();
  });
});

describe('FichasLocalesFacade · edición', () => {
  function facadeDeEdicion(guardada: FichaLocal) {
    const repo = jasmine.createSpyObj<FichasLocalesRepository>('FichasLocalesRepository', ['list', 'getById', 'update', 'desactivar']);
    repo.update.and.returnValue(of(guardada));
    repo.desactivar.and.returnValue(of(undefined));
    repo.getById.and.returnValue(of({ ...guardada, estado: 'DESPUBLICADO' }));
    TestBed.configureTestingModule({
      providers: [
        { provide: FichasLocalesRepository, useValue: repo },
        { provide: AdopcionesRepository, useValue: {} },
        { provide: PlantillasRepository, useValue: {} },
        { provide: OrganismosRepository, useValue: {} },
        { provide: LocalidadesRepository, useValue: { getLocalidades: () => of(LOCALIDADES) } },
        { provide: AuthTokenService, useValue: { getCurrentUser$: () => of({ id: 'u-1' }), can: () => false } },
      ],
    });
    return { facade: TestBed.inject(FichasLocalesFacade), repo };
  }

  const FORM = {
    adopcionId: 'op-1', localidadId: 'loc-posadas', slug: 'slug-f-1', url: '', requisitos: 'DNI', costos: '', activa: true,
  };

  it('sin base guarda con un solo PUT y dice que no despublicó', async () => {
    const { facade, repo } = facadeDeEdicion(ficha('f-1', 'op-1', 'loc-posadas'));
    const { ficha: vm, despublicada } = await firstValueFrom(facade.update('f-1', FORM));
    expect(repo.update).toHaveBeenCalledOnceWith('f-1', FORM);
    expect(repo.getById).not.toHaveBeenCalled();
    expect(repo.desactivar).not.toHaveBeenCalled();
    expect(vm.localidadNombre).toBe('Posadas');
    expect(despublicada).toBeFalse();
  });

  it('si el PUT dejó una ficha PUBLICADA inactiva, la completa con el DELETE, la relee y AVISA que la despublicó', async () => {
    const { facade, repo } = facadeDeEdicion({ ...ficha('f-1', 'op-1', 'loc-posadas', false), estado: 'PUBLICADO' });
    const { ficha: vm, despublicada } = await firstValueFrom(facade.update('f-1', { ...FORM, activa: false }));
    expect(repo.desactivar).toHaveBeenCalledOnceWith('f-1');
    expect(repo.getById).toHaveBeenCalledOnceWith('f-1');
    expect(vm.estado).toBe('DESPUBLICADO');
    expect(despublicada).toBeTrue();
  });

  it('si el DELETE del segundo paso falla, el error dice que los cambios SÍ se guardaron (no es "no se pudo guardar")', async () => {
    const guardada: FichaLocal = { ...ficha('f-1', 'op-1', 'loc-posadas', false), estado: 'PUBLICADO', version: 7 };
    const { facade, repo } = facadeDeEdicion(guardada);
    repo.desactivar.and.returnValue(throwError(() => ({ status: 500, error: { code: 5000 } })));
    const err = await firstValueFrom(facade.update('f-1', { ...FORM, activa: false })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DespublicacionFallidaError);
    // Lleva la ficha tal como la dejó el PUT: la pantalla la toma como nueva base.
    expect((err as DespublicacionFallidaError).ficha.version).toBe(7);
    expect((err as DespublicacionFallidaError).ficha.estado).toBe('PUBLICADO');
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('si el DELETE salió bien pero la relectura falla, igual informa la despublicación', async () => {
    const { facade, repo } = facadeDeEdicion({ ...ficha('f-1', 'op-1', 'loc-posadas', false), estado: 'PUBLICADO' });
    repo.getById.and.returnValue(throwError(() => ({ status: 0 })));
    const { ficha: vm, despublicada } = await firstValueFrom(facade.update('f-1', { ...FORM, activa: false }));
    expect(vm.estado).toBe('DESPUBLICADO');
    expect(despublicada).toBeTrue();
  });

  describe('con base (lo que leyó el form): relee antes de pisar', () => {
    const LEIDA = ficha('f-1', 'op-1', 'loc-posadas'); // versión 1, BORRADOR

    it('si la ficha sigue igual (misma versión y estado), guarda', async () => {
      const { facade, repo } = facadeDeEdicion({ ...LEIDA, version: 2 });
      repo.getById.and.returnValue(of(LEIDA));
      const { ficha: vm } = await firstValueFrom(facade.update('f-1', FORM, { version: 1, estado: 'BORRADOR', activa: true }));
      expect(repo.getById).toHaveBeenCalledOnceWith('f-1');
      expect(repo.update).toHaveBeenCalledOnceWith('f-1', FORM);
      expect(vm.version).toBe(2);
    });

    it('si otra persona la guardó (otra versión), NO manda el PUT y devuelve la ficha actual', async () => {
      const { facade, repo } = facadeDeEdicion(LEIDA);
      repo.getById.and.returnValue(of({ ...LEIDA, version: 4, requisitos: 'Lo que cargó otra persona' }));
      const err = await firstValueFrom(facade.update('f-1', FORM, { version: 1, estado: 'BORRADOR', activa: true })).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(FichaCambiadaError);
      expect((err as FichaCambiadaError).actual.version).toBe(4);
      expect((err as FichaCambiadaError).actual.localidadNombre).toBe('Posadas');
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('si le cambiaron el estado (misma versión), tampoco pisa', async () => {
      const { facade, repo } = facadeDeEdicion(LEIDA);
      repo.getById.and.returnValue(of({ ...LEIDA, estado: 'PUBLICADO' }));
      const err = await firstValueFrom(facade.update('f-1', FORM, { version: 1, estado: 'BORRADOR', activa: true })).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(FichaCambiadaError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('si la desactivaron (misma versión y estado: el DELETE no suma versión), tampoco pisa: el PUT la reactivaría', async () => {
      const { facade, repo } = facadeDeEdicion(LEIDA);
      repo.getById.and.returnValue(of({ ...LEIDA, activa: false }));
      const err = await firstValueFrom(facade.update('f-1', FORM, { version: 1, estado: 'BORRADOR', activa: true })).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(FichaCambiadaError);
      expect((err as FichaCambiadaError).actual.activa).toBeFalse();
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('con la base de la ficha actual (el usuario eligió guardar igual) sí guarda', async () => {
      const { facade, repo } = facadeDeEdicion({ ...LEIDA, version: 5 });
      repo.getById.and.returnValue(of({ ...LEIDA, version: 4 }));
      await firstValueFrom(facade.update('f-1', FORM, { version: 4, estado: 'BORRADOR', activa: true }));
      expect(repo.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('compatibilidad con un backend anterior a 586b670 (ficha sin contenido)', () => {
    it('sin adopción o localidad en el form no manda ningún PUT', async () => {
      const { facade, repo } = facadeDeEdicion(ficha('f-1', 'op-1', 'loc-posadas'));
      for (const incompleto of [{ ...FORM, adopcionId: '' }, { ...FORM, localidadId: '' }]) {
        const err = await firstValueFrom(facade.update('f-1', incompleto)).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(FichaSinContenidoError);
      }
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.getById).not.toHaveBeenCalled();
    });

    it('si la relectura previa llega sin contenido, tampoco manda el PUT', async () => {
      const { facade, repo } = facadeDeEdicion(ficha('f-1', 'op-1', 'loc-posadas'));
      repo.getById.and.returnValue(of({ ...ficha('f-1', '', ''), sinContenido: true }));
      const err = await firstValueFrom(facade.update('f-1', FORM, { version: 1, estado: 'BORRADOR', activa: true })).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(FichaSinContenidoError);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });
});

describe('FichasLocalesFacade · adopciones y plantillas sueltas (las que no vienen en sus listados)', () => {
  /** Un `Subject` por `GET /{id}` de adopción, para controlar cuántos hay en vuelo. */
  function facadeConSueltas(lista: FichaLocal[], getById: (id: string) => unknown) {
    const adopciones = { list: jasmine.createSpy('list').and.returnValue(of([])), getById: jasmine.createSpy('getById').and.callFake(getById) };
    const sesion$ = new BehaviorSubject<{ id: string }>({ id: 'u-1' });
    TestBed.configureTestingModule({
      providers: [
        { provide: FichasLocalesRepository, useValue: { list: () => of(lista) } },
        { provide: AdopcionesRepository, useValue: adopciones },
        { provide: PlantillasRepository, useValue: {} },
        { provide: OrganismosRepository, useValue: {} },
        { provide: LocalidadesRepository, useValue: { getLocalidades: () => of(LOCALIDADES) } },
        { provide: AuthTokenService, useValue: { getCurrentUser$: () => sesion$.asObservable(), can: (p: string) => p === 'READ_ADOPTION' } },
      ],
    });
    return { facade: TestBed.inject(FichasLocalesFacade), adopciones, sesion$ };
  }

  const suelta = (id: string, extra: object = {}) => ({
    id, plantillaId: 'p-1', organismoId: 'o-1', organismoTitularId: null, habilitada: false,
    vigenteDesde: new Date(AHORA - DIA), vigenteHasta: null, ...extra,
  });

  it('una adopción deshabilitada se pide UNA vez: recargar el listado no la vuelve a pedir', async () => {
    const { facade, adopciones } = facadeConSueltas(
      [ficha('f-1', 'op-1', 'loc-posadas'), ficha('f-2', 'op-1', 'loc-garupa')],
      (id) => of(suelta(id)),
    );
    const primera = await firstValueFrom(facade.loadFichas());
    await firstValueFrom(facade.loadFichas());
    expect(adopciones.getById).toHaveBeenCalledOnceWith('op-1');
    expect(primera[0].plantillaId).toBe('p-1');
    expect(primera[0].adopcionNoVigente).toBe('deshabilitada');
  });

  it('una que no existe (404) tampoco se vuelve a pedir; una que falló por conexión, sí', async () => {
    const { facade, adopciones } = facadeConSueltas(
      [ficha('f-1', 'op-404', 'loc-posadas'), ficha('f-2', 'op-red', 'loc-garupa')],
      (id) => throwError(() => ({ status: id === 'op-404' ? 404 : 0 })),
    );
    await firstValueFrom(facade.loadFichas());
    await firstValueFrom(facade.loadFichas());
    const pedidos = adopciones.getById.calls.allArgs().map(([id]) => id);
    expect(pedidos.filter((id) => id === 'op-404').length).toBe(1);
    expect(pedidos.filter((id) => id === 'op-red').length).toBe(2);
  });

  it('al cambiar de sesión lo recordado se descarta', async () => {
    const { facade, adopciones, sesion$ } = facadeConSueltas([ficha('f-1', 'op-1', 'loc-posadas')], (id) => of(suelta(id)));
    await firstValueFrom(facade.loadFichas());
    sesion$.next({ id: 'u-2' });
    await firstValueFrom(facade.loadFichas());
    expect(adopciones.getById).toHaveBeenCalledTimes(2);
  });

  it('pide de a 4 como mucho: con 10 adopciones sueltas no abre 10 conexiones a la vez', async () => {
    const pendientes: Array<Subject<unknown>> = [];
    let enVuelo = 0;
    let maximo = 0;
    const { facade } = facadeConSueltas(
      Array.from({ length: 10 }, (_, i) => ficha(`f-${i}`, `op-${i}`, 'loc-posadas')),
      () => {
        const respuesta$ = new Subject<unknown>();
        pendientes.push(respuesta$);
        return defer(() => {
          enVuelo++;
          maximo = Math.max(maximo, enVuelo);
          return respuesta$.pipe(finalize(() => enVuelo--));
        });
      },
    );
    const carga = firstValueFrom(facade.loadFichas());
    // Cada respuesta libera un lugar para la siguiente.
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      pendientes[i].next(suelta(`op-${i}`));
      pendientes[i].complete();
    }
    expect((await carga).length).toBe(10);
    expect(maximo).toBe(4);
  });

  describe('lectura de UNA ficha (detalle / form): la vigencia no sale de la caché de la sesión', () => {
    function facadeDeDetalle() {
      const F = ficha('f-1', 'op-1', 'loc-posadas');
      /** Lo que hay "en el servidor": el listado solo trae las habilitadas; `GET /{id}`, cualquiera. */
      let adopcion = { ...suelta('op-1'), habilitada: true };
      const adopciones = {
        list: jasmine.createSpy('list').and.callFake(() => of(adopcion.habilitada ? [adopcion] : [])),
        getById: jasmine.createSpy('getById').and.callFake(() => of(adopcion)),
      };
      TestBed.configureTestingModule({
        providers: [
          { provide: FichasLocalesRepository, useValue: { list: () => of([F]), getById: () => of(F) } },
          { provide: AdopcionesRepository, useValue: adopciones },
          { provide: PlantillasRepository, useValue: {} },
          { provide: OrganismosRepository, useValue: {} },
          { provide: LocalidadesRepository, useValue: { getLocalidades: () => of(LOCALIDADES) } },
          { provide: AuthTokenService, useValue: { getCurrentUser$: () => of({ id: 'u-1' }), can: (p: string) => p === 'READ_ADOPTION' } },
        ],
      });
      return { facade: TestBed.inject(FichasLocalesFacade), adopciones, cambiar: (extra: object) => { adopcion = { ...adopcion, ...extra }; } };
    }

    it('getDetalle: si deshabilitan la adopción después de la primera lectura, la siguiente lo dice; y al revés', async () => {
      const { facade, cambiar } = facadeDeDetalle();
      expect((await firstValueFrom(facade.getDetalle('f-1'))).adopcionNoVigente).toBeNull();

      cambiar({ habilitada: false });
      expect((await firstValueFrom(facade.getDetalle('f-1'))).adopcionNoVigente as string).toBe('deshabilitada');

      cambiar({ habilitada: true });
      expect((await firstValueFrom(facade.getDetalle('f-1'))).adopcionNoVigente).toBeNull();
    });

    it('getDetalle: un cambio de vigencia (venció) de una adopción habilitada también se ve', async () => {
      const { facade, cambiar } = facadeDeDetalle();
      await firstValueFrom(facade.getDetalle('f-1'));

      cambiar({ vigenteDesde: new Date(AHORA - 3 * DIA), vigenteHasta: new Date(AHORA - DIA) });

      expect((await firstValueFrom(facade.getDetalle('f-1'))).adopcionNoVigente as string).toBe('vencida');
    });

    it('getDetalle: una adopción deshabilitada ya recordada se vuelve a pedir (pudo cambiar), una sola vez por lectura', async () => {
      const { facade, adopciones, cambiar } = facadeDeDetalle();
      cambiar({ habilitada: false });
      await firstValueFrom(facade.loadFichas());
      expect(adopciones.getById).toHaveBeenCalledTimes(1);

      await firstValueFrom(facade.getDetalle('f-1'));
      expect(adopciones.getById).toHaveBeenCalledTimes(2);

      // El listado sigue sin volver a pedirla.
      await firstValueFrom(facade.loadFichas());
      await firstValueFrom(facade.loadFichas());
      expect(adopciones.getById).toHaveBeenCalledTimes(2);
    });

    it('getFormData (edición): la ficha llega con la vigencia al día', async () => {
      const { facade, cambiar } = facadeDeDetalle();
      expect((await firstValueFrom(facade.getFormData('f-1', null))).ficha!.adopcionNoVigente).toBeNull();

      cambiar({ habilitada: false });
      const datos = await firstValueFrom(facade.getFormData('f-1', null));

      expect(datos.ficha!.adopcionNoVigente as string).toBe('deshabilitada');
      expect(datos.adopcion!.motivoNoVigente as string).toBe('deshabilitada');
    });
  });

  it('una ficha sin contenido (sin adopción) no dispara un GET con id vacío', async () => {
    const { facade, adopciones } = facadeConSueltas([{ ...ficha('f-1', '', ''), sinContenido: true }], (id) => of(suelta(id)));
    const [vm] = await firstValueFrom(facade.loadFichas());
    expect(adopciones.getById).not.toHaveBeenCalled();
    expect(vm.sinContenido).toBeTrue();
    expect(vm.adopcionNoVigente).toBeNull();
  });
});

describe('FichasLocalesFacade · vigencia de la adopción en la ficha', () => {
  it('con la adopción vigente queda en null; sin poder leerla también (sin decidir)', async () => {
    const vigente = facadeCon([ficha('f-1', 'op-1', 'loc-posadas')], { permisos: ['READ_ADOPTION'], adopcion: adopcionCon() });
    expect((await firstValueFrom(vigente.loadFichas()))[0].adopcionNoVigente).toBeNull();
    TestBed.resetTestingModule();
    const sinPermiso = facadeCon([ficha('f-1', 'op-1', 'loc-posadas')], { adopcion: adopcionCon({ habilitada: false }) });
    expect((await firstValueFrom(sinPermiso.loadFichas()))[0].adopcionNoVigente).toBeNull();
  });

  it('con la adopción vencida lo dice: una ficha publicada así no se ve en el portal', async () => {
    const facade = facadeCon([ficha('f-1', 'op-1', 'loc-posadas')], {
      permisos: ['READ_ADOPTION'],
      adopcion: adopcionCon({ vigenteDesde: new Date(AHORA - 3 * DIA), vigenteHasta: new Date(AHORA - DIA) }),
    });
    expect((await firstValueFrom(facade.loadFichas()))[0].adopcionNoVigente as string).toBe('vencida');
  });
});

describe('FichasLocalesFacade · datos del form de alta (duplicados de localidad)', () => {
  it('con la forma completa marca las localidades con ficha de la adopción, activa o desactivada', async () => {
    const facade = facadeCon([
      ficha('f-1', 'op-1', 'loc-posadas'),
      ficha('f-2', 'op-1', 'loc-garupa', false),
      ficha('f-3', 'op-2', 'loc-garupa'),
    ]);
    const datos = await firstValueFrom(facade.getFormData(null, 'op-1'));
    // El UNIQUE (adopción, localidad) del backend incluye las desactivadas.
    expect(datos.ocupadas.localidadIds).toEqual(['loc-posadas', 'loc-garupa']);
    expect(datos.ocupadas.localidadIdsDesactivadas).toEqual(['loc-garupa']);
  });

  it('los slugs de las fichas desactivadas también cuentan como usados', async () => {
    const facade = facadeCon([ficha('f-1', 'op-1', 'loc-posadas'), ficha('f-2', 'op-2', 'loc-garupa', false)]);
    const datos = await firstValueFrom(facade.getFormData(null, 'op-1'));
    expect(datos.ocupadas.slugs).toEqual(['slug-f-1', 'slug-f-2']);
  });

  it('en edición, la propia ficha no cuenta como ocupada', async () => {
    const lista = [ficha('f-1', 'op-1', 'loc-posadas'), ficha('f-2', 'op-1', 'loc-garupa')];
    const facade = facadeCon(lista);
    (TestBed.inject(FichasLocalesRepository) as unknown as { getById: () => unknown }).getById = () => of(lista[0]);
    const datos = await firstValueFrom(facade.getFormData('f-1', null));
    expect(datos.ficha?.id).toBe('f-1');
    expect(datos.ocupadas.localidadIds).toEqual(['loc-garupa']);
    expect(datos.ocupadas.slugs).toEqual(['slug-f-2']);
  });
});

describe('FichasLocalesFacade · trámites del organismo para el alta de una ficha', () => {
  const DESDE = new Date(AHORA - DIA);
  const adopcion = (id: string, plantillaId: string, organismoId: string, habilitada = true, extra: object = {}) => ({
    id, plantillaId, organismoId, organismoTitularId: null, habilitada, vigenteDesde: DESDE, vigenteHasta: null, ...extra,
  });

  function facadeConAdopciones(permisos: string[]): FichasLocalesFacade {
    const auth = {
      getCurrentUser$: () => new BehaviorSubject({ id: 'u-1' }).asObservable(),
      can: (p: string) => permisos.includes(p),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: FichasLocalesRepository, useValue: { list: () => of([]) } },
        {
          provide: AdopcionesRepository,
          useValue: {
            list: () => of([
              adopcion('a-1', 'p-2', 'o-1'),
              adopcion('a-2', 'p-1', 'o-2'),
              adopcion('a-3', 'p-1', 'o-1'),
              adopcion('a-4', 'p-3', 'o-1', false),
              adopcion('a-5', 'p-9', 'o-1'),
              adopcion('a-6', 'p-1', 'o-3', true, { vigenteDesde: new Date(AHORA + DIA) }),
              adopcion('a-7', 'p-2', 'o-3', true, { vigenteDesde: new Date(AHORA - 3 * DIA), vigenteHasta: new Date(AHORA - DIA) }),
            ]),
          },
        },
        {
          provide: PlantillasRepository,
          useValue: {
            list: () => of([
              { id: 'p-1', titulo: 'Obtener la licencia', slug: 'licencia' },
              { id: 'p-2', titulo: 'Inscribirse al registro', slug: 'registro' },
            ]),
          },
        },
        { provide: OrganismosRepository, useValue: { list: () => of([{ id: 'o-1', nombre: 'Posadas' }, { id: 'o-2', nombre: 'Oberá' }]) } },
        { provide: LocalidadesRepository, useValue: { getLocalidades: () => of(LOCALIDADES) } },
        { provide: AuthTokenService, useValue: auth },
      ],
    });
    return TestBed.inject(FichasLocalesFacade);
  }

  it('sin READ_ADOPTION no pide nada y devuelve una lista vacía', async () => {
    const lista = await firstValueFrom(facadeConAdopciones([]).getAdopcionesParaFicha());
    expect(lista).toEqual([]);
  });

  it('ofrece solo las habilitadas, con nombres, ordenadas por trámite y organismo, y las sin nombre al final', async () => {
    const lista = await firstValueFrom(facadeConAdopciones(['READ_ADOPTION', 'READ_PROCEDURE', 'READ_ORGANISM']).getAdopcionesParaFicha());
    const vigentes = lista.filter((a) => a.vigente);
    expect(vigentes.map((a) => a.id)).toEqual(['a-1', 'a-2', 'a-3', 'a-5']);
    expect(vigentes[1]).toEqual({
      id: 'a-2', plantillaTitulo: 'Obtener la licencia', plantillaSlug: 'licencia', organismoNombre: 'Oberá', habilitada: true,
      vigente: true, motivoNoVigente: null, vigenteDesde: DESDE, vigenteHasta: null,
    });
    expect(vigentes[3].plantillaTitulo).toBeNull();
    // La deshabilitada no viene (el listado del backend no la trae).
    expect(lista.some((a) => a.id === 'a-4')).toBeFalse();
  });

  it('las habilitadas que todavía no rigen o ya vencieron vienen marcadas como no vigentes, con el motivo', async () => {
    const lista = await firstValueFrom(facadeConAdopciones(['READ_ADOPTION', 'READ_PROCEDURE', 'READ_ORGANISM']).getAdopcionesParaFicha());
    const programada = lista.find((a) => a.id === 'a-6')!;
    const vencida = lista.find((a) => a.id === 'a-7')!;
    expect(programada.vigente).toBeFalse();
    expect(programada.motivoNoVigente).toBe('programada');
    expect(vencida.vigente).toBeFalse();
    expect(vencida.motivoNoVigente).toBe('vencida');
  });
});

describe('FichasLocalesFacade · fuenteSimulada', () => {
  it('la expone tal como la dice el repository (la capacidad es de la fuente)', () => {
    for (const simulada of [true, false]) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: FichasLocalesRepository, useValue: { list: () => of([]), fuenteSimulada: simulada } },
          { provide: AdopcionesRepository, useValue: {} },
          { provide: PlantillasRepository, useValue: {} },
          { provide: OrganismosRepository, useValue: {} },
          { provide: LocalidadesRepository, useValue: { getLocalidades: () => of([]) } },
          { provide: AuthTokenService, useValue: { getCurrentUser$: () => of({ id: 'u-1' }), can: () => false } },
        ],
      });
      expect(TestBed.inject(FichasLocalesFacade).fuenteSimulada).toBe(simulada);
    }
  });
});
