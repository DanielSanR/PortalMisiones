import { estadoDeVigencia } from './vigencia';

describe('estadoDeVigencia', () => {
  const desde = new Date(2026, 0, 1, 0, 0, 0);
  const hasta = new Date(2026, 11, 31, 23, 59, 59);

  it('programada antes del inicio', () => {
    expect(estadoDeVigencia(desde, hasta, new Date(2025, 11, 31, 23, 59, 59))).toBe('programada');
  });

  it('vigente desde el inicio (inclusive)', () => {
    expect(estadoDeVigencia(desde, hasta, desde)).toBe('vigente');
    expect(estadoDeVigencia(desde, null, new Date(2030, 0, 1))).toBe('vigente');
  });

  it('vencida desde el fin (exclusive)', () => {
    expect(estadoDeVigencia(desde, hasta, hasta)).toBe('vencida');
  });
});
