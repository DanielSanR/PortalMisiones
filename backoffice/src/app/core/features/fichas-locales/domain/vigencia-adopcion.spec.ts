import { instanteDeVigencia, motivoNoVigente } from './vigencia-adopcion';

describe('motivoNoVigente (regla de `OrganismProcedure.isEffectiveAt`)', () => {
  const ahora = new Date(2026, 10, 19, 12, 0, 0);
  const ayer = new Date(2026, 10, 18, 12, 0, 0);
  const maniana = new Date(2026, 10, 20, 12, 0, 0);

  it('habilitada, ya empezó y sin fin: vigente', () => {
    expect(motivoNoVigente({ habilitada: true, vigenteDesde: ayer, vigenteHasta: null }, ahora)).toBeNull();
  });

  it('habilitada, ya empezó y con fin futuro: vigente', () => {
    expect(motivoNoVigente({ habilitada: true, vigenteDesde: ayer, vigenteHasta: maniana }, ahora)).toBeNull();
  });

  it('el inicio es inclusive y el fin exclusive', () => {
    expect(motivoNoVigente({ habilitada: true, vigenteDesde: ahora, vigenteHasta: null }, ahora)).toBeNull();
    expect(motivoNoVigente({ habilitada: true, vigenteDesde: ayer, vigenteHasta: ahora }, ahora)).toBe('vencida');
  });

  it('deshabilitada gana sobre las fechas', () => {
    expect(motivoNoVigente({ habilitada: false, vigenteDesde: ayer, vigenteHasta: null }, ahora)).toBe('deshabilitada');
  });

  it('todavía no empezó: programada', () => {
    expect(motivoNoVigente({ habilitada: true, vigenteDesde: maniana, vigenteHasta: null }, ahora)).toBe('programada');
  });

  it('ya venció: vencida', () => {
    expect(motivoNoVigente({ habilitada: true, vigenteDesde: new Date(2026, 0, 1), vigenteHasta: ayer }, ahora)).toBe('vencida');
  });
});

describe('instanteDeVigencia (único punto de conversión de las fechas de vigencia)', () => {
  it('hoy toma la fecha como hora de pared del navegador (supuesto documentado: el backend marca la misma hora)', () => {
    const fecha = new Date(2026, 10, 19, 0, 0, 0);
    expect(instanteDeVigencia(fecha)).toBe(fecha.getTime());
  });
});
