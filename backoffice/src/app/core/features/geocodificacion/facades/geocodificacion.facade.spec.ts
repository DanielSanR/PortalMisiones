import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { GeocodificacionFacade, ZOOM_DE_LOCALIDAD } from './geocodificacion.facade';
import { GeocodificacionRepository } from '../repositories/geocodificacion.repository';
import { LugarVM } from '../models/lugar.vm';

const OBERA: LugarVM = { id: '1', nombre: 'Oberá', detalle: 'Misiones', coordenadas: { latitud: -27.48, longitud: -55.12 } };

describe('GeocodificacionFacade', () => {
  let repo: jasmine.SpyObj<GeocodificacionRepository> & { disponible: boolean };
  let facade: GeocodificacionFacade;

  const crear = (disponible = true): void => {
    repo = Object.assign(jasmine.createSpyObj<GeocodificacionRepository>('GeocodificacionRepository', ['buscar']), { disponible });
    TestBed.configureTestingModule({ providers: [GeocodificacionFacade, { provide: GeocodificacionRepository, useValue: repo }] });
    facade = TestBed.inject(GeocodificacionFacade);
  };

  describe('buscarDireccion', () => {
    it('busca la dirección con la localidad y la provincia', async () => {
      crear();
      repo.buscar.and.returnValue(of([OBERA]));
      expect(await firstValueFrom(facade.buscarDireccion('Sarmiento 55', 'Oberá'))).toEqual([OBERA]);
      expect(repo.buscar).toHaveBeenCalledOnceWith('Sarmiento 55, Oberá, Misiones, Argentina');
    });

    it('sin dirección no consulta', async () => {
      crear();
      expect(await firstValueFrom(facade.buscarDireccion('  ', 'Oberá'))).toEqual([]);
      expect(repo.buscar).not.toHaveBeenCalled();
    });

    it('sin proveedor falla sin consultar', async () => {
      crear(false);
      await expectAsync(firstValueFrom(facade.buscarDireccion('Sarmiento 55', null))).toBeRejected();
      expect(repo.buscar).not.toHaveBeenCalled();
    });
  });

  describe('encuadreDeLocalidad', () => {
    it('centra en el primer resultado, y consulta UNA vez por localidad', async () => {
      crear();
      repo.buscar.and.returnValue(of([OBERA]));
      const esperado = { centro: OBERA.coordenadas, zoom: ZOOM_DE_LOCALIDAD };
      expect(await firstValueFrom(facade.encuadreDeLocalidad('Oberá'))).toEqual(esperado);
      expect(await firstValueFrom(facade.encuadreDeLocalidad('Oberá'))).toEqual(esperado);
      expect(repo.buscar).toHaveBeenCalledOnceWith('Oberá, Misiones, Argentina');
    });

    it('nunca falla: sin resultados, con error o sin proveedor emite null (el mapa abre en la provincia)', async () => {
      crear();
      repo.buscar.and.returnValue(of([]));
      expect(await firstValueFrom(facade.encuadreDeLocalidad('Nada'))).toBeNull();
      repo.buscar.and.returnValue(throwError(() => new Error('caído')));
      expect(await firstValueFrom(facade.encuadreDeLocalidad('Oberá'))).toBeNull();
      expect(await firstValueFrom(facade.encuadreDeLocalidad(null))).toBeNull();
    });

    it('un error no se cachea: la próxima apertura vuelve a intentar', async () => {
      crear();
      repo.buscar.and.returnValues(throwError(() => new Error('caído')), of([OBERA]));
      expect(await firstValueFrom(facade.encuadreDeLocalidad('Oberá'))).toBeNull();
      expect(await firstValueFrom(facade.encuadreDeLocalidad('Oberá'))).not.toBeNull();
      expect(repo.buscar).toHaveBeenCalledTimes(2);
    });

    it('sin proveedor no consulta', async () => {
      crear(false);
      expect(await firstValueFrom(facade.encuadreDeLocalidad('Oberá'))).toBeNull();
      expect(repo.buscar).not.toHaveBeenCalled();
    });
  });
});
