import { firstValueFrom } from 'rxjs';
import { GeocodificacionMockDataSource } from './geocodificacion.mock.datasource';

describe('GeocodificacionMockDataSource', () => {
  const ds = new GeocodificacionMockDataSource();

  it('la localidad sola devuelve su centro', async () => {
    const lugares = await firstValueFrom(ds.buscar('Oberá, Misiones, Argentina'));
    expect(lugares.length).toBe(1);
    expect(lugares[0].nombre).toBe('Oberá');
  });

  it('una calle en una localidad conocida devuelve dos lugares para elegir', async () => {
    const lugares = await firstValueFrom(ds.buscar('San Martín 123, Posadas, Misiones, Argentina'));
    expect(lugares.map((l) => l.nombre)).toEqual(['San Martín 123', 'San Martín 123 (barrio)']);
  });

  it('sin localidad conocida no encuentra nada', async () => {
    expect(await firstValueFrom(ds.buscar('Calle falsa 123, Springfield'))).toEqual([]);
  });

  it('"falla" simula el servicio caído (status 0), como un error de red real', async () => {
    await expectAsync(firstValueFrom(ds.buscar('falla, Posadas'))).toBeRejectedWith(jasmine.objectContaining({ status: 0 }));
  });
});
