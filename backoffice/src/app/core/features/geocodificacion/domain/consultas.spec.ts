import { consultaDeDireccion, consultaDeLocalidad } from './consultas';

describe('consultas de geocodificación', () => {
  it('suma la localidad de la ficha, la provincia y el país a la dirección', () => {
    expect(consultaDeDireccion('  Av. Uruguay   3150 ', 'Posadas')).toBe('Av. Uruguay 3150, Posadas, Misiones, Argentina');
  });

  it('si la dirección ya dice una localidad (después de una coma) manda esa y no la de la ficha', () => {
    expect(consultaDeDireccion('Av. Uruguay 3150, POSADAS', 'Posadas')).toBe('Av. Uruguay 3150, POSADAS, Misiones, Argentina');
    expect(consultaDeDireccion('Av. Uruguay 3150, Posadas', 'Apóstoles')).toBe('Av. Uruguay 3150, Posadas, Misiones, Argentina');
  });

  it('sin localidad busca en la provincia; sin dirección no hay consulta', () => {
    expect(consultaDeDireccion('San Martín 123', null)).toBe('San Martín 123, Misiones, Argentina');
    expect(consultaDeDireccion('   ', 'Oberá')).toBe('');
  });

  it('la localidad sola, para centrar el mapa', () => {
    expect(consultaDeLocalidad('Oberá')).toBe('Oberá, Misiones, Argentina');
    expect(consultaDeLocalidad(null)).toBe('');
  });
});
