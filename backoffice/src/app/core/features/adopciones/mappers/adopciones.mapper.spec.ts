import { OrganismProcedureResponseDTO } from '../models/adopcion.dto';
import { AdopcionFormValue } from '../models/adopcion.vm';
import { parseLocalDateTime, toAdopcion, toLocalDateTime, toOrganismProcedureRequest } from './adopciones.mapper';

const DTO: OrganismProcedureResponseDTO = {
  id: 'op-1',
  procedureTemplateId: 'pt-1',
  organismId: 'org-1',
  ownerOrganismId: null,
  enabled: true,
  effectiveFrom: '2026-01-01T00:00',
  effectiveTo: '2026-12-31T23:59:59',
};

const FORM: AdopcionFormValue = {
  plantillaId: 'pt-2',
  organismoId: 'org-2',
  organismoTitularId: '',
  habilitada: true,
  vigenteDesde: new Date(2026, 9, 13, 0, 0, 0),
  vigenteHasta: new Date(2027, 0, 5, 23, 59, 59),
};

describe('adopciones.mapper', () => {
  describe('parseLocalDateTime', () => {
    it('lee el formato de Jackson con y sin segundos, en hora local', () => {
      const sinSegundos = parseLocalDateTime('2026-01-01T00:00');
      expect(sinSegundos.getFullYear()).toBe(2026);
      expect(sinSegundos.getMonth()).toBe(0);
      expect(sinSegundos.getDate()).toBe(1);
      expect(sinSegundos.getHours()).toBe(0);

      const conFraccion = parseLocalDateTime('2026-12-31T23:59:59.123456');
      expect(conFraccion.getDate()).toBe(31);
      expect(conFraccion.getHours()).toBe(23);
      expect(conFraccion.getSeconds()).toBe(59);
    });
  });

  describe('toLocalDateTime', () => {
    it('serializa sin zona ni milisegundos', () => {
      expect(toLocalDateTime(new Date(2026, 2, 5, 7, 8, 9, 999))).toBe('2026-03-05T07:08:09');
    });

    it('ida y vuelta con parseLocalDateTime', () => {
      const texto = '2026-10-13T23:59:59';
      expect(toLocalDateTime(parseLocalDateTime(texto))).toBe(texto);
    });
  });

  describe('toAdopcion', () => {
    it('mapea ids, habilitada y fechas', () => {
      const a = toAdopcion(DTO);
      expect(a.id).toBe('op-1');
      expect(a.plantillaId).toBe('pt-1');
      expect(a.organismoId).toBe('org-1');
      expect(a.organismoTitularId).toBeNull();
      expect(a.habilitada).toBeTrue();
      expect(toLocalDateTime(a.vigenteDesde)).toBe('2026-01-01T00:00:00');
      expect(a.vigenteHasta && toLocalDateTime(a.vigenteHasta)).toBe('2026-12-31T23:59:59');
    });

    it('sin effectiveTo deja la vigencia abierta', () => {
      expect(toAdopcion({ ...DTO, effectiveTo: null }).vigenteHasta).toBeNull();
    });
  });

  describe('toOrganismProcedureRequest', () => {
    it('manda las fechas tal cual, sin zona ni milisegundos (los bordes del día los decide el form)', () => {
      const req = toOrganismProcedureRequest(FORM);
      expect(req.effectiveFrom).toBe('2026-10-13T00:00:00');
      expect(req.effectiveTo).toBe('2027-01-05T23:59:59');
      expect(req.effectiveFrom).not.toContain('Z');
      const conHora = toOrganismProcedureRequest({ ...FORM, vigenteDesde: new Date(2026, 9, 13, 15, 42, 7, 500) });
      expect(conHora.effectiveFrom).toBe('2026-10-13T15:42:07');
    });

    it('manda enabled y ownerOrganismId siempre (PUT total), el titular vacío como null', () => {
      const req = toOrganismProcedureRequest(FORM);
      expect(req.procedureTemplateId).toBe('pt-2');
      expect(req.organismId).toBe('org-2');
      expect(req.enabled).toBeTrue();
      expect(req.ownerOrganismId).toBeNull();
      expect(Object.prototype.hasOwnProperty.call(req, 'ownerOrganismId')).toBeTrue();
      expect(toOrganismProcedureRequest({ ...FORM, organismoTitularId: 'org-9' }).ownerOrganismId).toBe('org-9');
    });

    it('sin hasta manda effectiveTo null', () => {
      expect(toOrganismProcedureRequest({ ...FORM, vigenteHasta: null }).effectiveTo).toBeNull();
    });
  });
});
