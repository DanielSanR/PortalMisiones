import { FormControl } from '@angular/forms';
import { coordenadaValida, formatearCoordenada, parsearCoordenada, urlMapa } from './coordenadas';

describe('coordenadas', () => {
  const latitud = coordenadaValida(-90, 90);
  const longitud = coordenadaValida(-180, 180);
  const validar = (validador: typeof latitud, valor: string) => validador(new FormControl(valor));

  it('parsearCoordenada acepta coma o punto y rechaza texto', () => {
    expect(parsearCoordenada('-27,3671')).toBe(-27.3671);
    expect(parsearCoordenada(' -55.8961 ')).toBe(-55.8961);
    expect(parsearCoordenada('+12')).toBe(12);
    expect(parsearCoordenada('abc')).toBeNull();
    expect(parsearCoordenada('1.2.3')).toBeNull();
    expect(parsearCoordenada('')).toBeNull();
  });

  it('valida el rango de latitud y longitud', () => {
    expect(validar(latitud, '-90')).toBeNull();
    expect(validar(latitud, '90,000001')).toEqual({ rango: { min: -90, max: 90 } });
    expect(validar(longitud, '-180')).toBeNull();
    expect(validar(longitud, '180.5')).toEqual({ rango: { min: -180, max: 180 } });
  });

  it('acepta hasta 6 decimales', () => {
    expect(validar(latitud, '-27,123456')).toBeNull();
    expect(validar(latitud, '-27,1234567')).toEqual({ decimales: { max: 6 } });
  });

  it('marca lo que no es número y deja el vacío a required', () => {
    expect(validar(latitud, 'norte')).toEqual({ numero: true });
    expect(validar(latitud, '  ')).toBeNull();
  });

  it('formatearCoordenada usa coma decimal', () => {
    expect(formatearCoordenada(-27.3671)).toBe('-27,3671');
    expect(formatearCoordenada(null)).toBe('');
  });

  it('urlMapa arma el link de OpenStreetMap con marcador', () => {
    expect(urlMapa(-27.3671, -55.8961))
      .toBe('https://www.openstreetmap.org/?mlat=-27.3671&mlon=-55.8961#map=17/-27.3671/-55.8961');
  });
});
