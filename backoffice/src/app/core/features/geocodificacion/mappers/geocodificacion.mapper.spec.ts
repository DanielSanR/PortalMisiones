import { toLugarVM, toLugaresVM } from './geocodificacion.mapper';
import { NominatimLugarDTO } from '../models/lugar.dto';

const OFICINA: NominatimLugarDTO = {
  place_id: 123,
  lat: '-27.3671041234',
  lon: '-55.8961089876',
  display_name: '3150, Avenida Uruguay, Villa Sarita, Posadas, Municipio de Posadas, Capital, Misiones, N3300, Argentina',
};

describe('geocodificacion.mapper', () => {
  it('reúne número y calle como nombre; el detalle va sin código postal ni país; coordenadas a 6 decimales', () => {
    expect(toLugarVM(OFICINA)).toEqual({
      id: '123',
      nombre: 'Avenida Uruguay 3150',
      detalle: 'Villa Sarita, Posadas, Municipio de Posadas, Capital, Misiones',
      coordenadas: { latitud: -27.367104, longitud: -55.896109 },
    });
  });

  it('un lugar sin número queda con su primer tramo como nombre', () => {
    expect(toLugarVM({ ...OFICINA, display_name: 'Oberá, Misiones, Argentina' })!.nombre).toBe('Oberá');
  });

  it('descarta resultados sin coordenadas numéricas y tolera una respuesta nula', () => {
    expect(toLugarVM({ ...OFICINA, lat: 'x' })).toBeNull();
    expect(toLugaresVM([OFICINA, { ...OFICINA, place_id: 2, lat: 'no' }]).length).toBe(1);
    expect(toLugaresVM(null)).toEqual([]);
  });
});
