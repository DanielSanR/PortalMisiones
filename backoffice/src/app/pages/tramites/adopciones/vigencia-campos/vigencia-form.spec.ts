import { crearVigenciaForm, rangoDeVigencia } from './vigencia-form';

describe('vigencia-form', () => {
  it('"hasta" el mismo día que "desde" es válido; un día antes, no', () => {
    const grupo = crearVigenciaForm(new Date(2026, 9, 13), new Date(2026, 9, 13));
    expect(grupo.valid).toBeTrue();
    grupo.controls.vigenteHasta.setValue(new Date(2026, 9, 12));
    expect(grupo.controls.vigenteHasta.hasError('hastaAnterior')).toBeTrue();
  });

  it('"desde" es obligatoria; "hasta", no', () => {
    const grupo = crearVigenciaForm();
    expect(grupo.controls.vigenteDesde.hasError('required')).toBeTrue();
    expect(grupo.controls.vigenteHasta.valid).toBeTrue();
  });

  it('lo editado va a los bordes del día', () => {
    const grupo = crearVigenciaForm(new Date(2026, 9, 13), new Date(2026, 11, 31));
    const { vigenteDesde, vigenteHasta } = rangoDeVigencia(grupo);
    expect(vigenteDesde.getHours()).toBe(0);
    expect(vigenteHasta?.getHours()).toBe(23);
    expect(vigenteHasta?.getSeconds()).toBe(59);
  });

  it('sin tocar los campos reenvía las horas originales', () => {
    const original = { vigenteDesde: new Date(2026, 0, 1, 10, 30), vigenteHasta: new Date(2027, 0, 1, 0, 0) };
    const grupo = crearVigenciaForm(new Date(2026, 0, 1), new Date(2027, 0, 1));
    expect(rangoDeVigencia(grupo, original)).toEqual(original);

    grupo.controls.vigenteHasta.setValue(new Date(2027, 5, 30));
    grupo.controls.vigenteHasta.markAsDirty();
    const editado = rangoDeVigencia(grupo, original);
    expect(editado.vigenteDesde).toBe(original.vigenteDesde);
    expect(editado.vigenteHasta?.getMonth()).toBe(5);
    expect(editado.vigenteHasta?.getHours()).toBe(23);
  });
});
