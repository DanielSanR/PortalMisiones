import { OrganismProcedureLocationResponseDTO } from '../models/ficha-local.dto';
import { FichaLocalFormValue } from '../models/ficha-local.vm';
import { toFichaLocal, toOrganismProcedureLocationRequest } from './fichas-locales.mapper';

const MINIMO: OrganismProcedureLocationResponseDTO = {
  id: 'fl-1',
  slug: 'obtener-licencia-posadas',
  publicationStatus: 'PUBLICADO',
  active: true,
  currentVersionNumber: 3,
};

const FORM: FichaLocalFormValue = {
  adopcionId: 'op-1',
  localidadId: 'loc-posadas',
  slug: 'Obtener Licencia — Posadas',
  url: '  ',
  requisitos: ' DNI ',
  costos: '',
  activa: true,
};

describe('fichas-locales.mapper', () => {
  describe('toFichaLocal', () => {
    it('con el response mínimo de hoy (G-1) deja el contenido en null y no está completo', () => {
      const f = toFichaLocal(MINIMO);
      expect(f.id).toBe('fl-1');
      expect(f.estado).toBe('PUBLICADO');
      expect(f.activa).toBeTrue();
      expect(f.version).toBe(3);
      expect(f.adopcionId).toBeNull();
      expect(f.localidadId).toBeNull();
      expect(f.url).toBeNull();
      expect(f.requisitos).toBeNull();
      expect(f.costos).toBeNull();
      expect(f.plantillaTitulo).toBeNull();
      expect(f.contenidoCompleto).toBeFalse();
    });

    it('con el response extendido mapea contenido y nombres', () => {
      const f = toFichaLocal({
        ...MINIMO,
        organismProcedureId: 'op-1',
        locationId: 'loc-posadas',
        url: 'https://x',
        requirements: 'DNI',
        costs: '$1',
        procedureTitle: 'Obtener la licencia',
        organismName: ' ',
        locationName: 'Posadas',
      });
      expect(f.contenidoCompleto).toBeTrue();
      expect(f.adopcionId).toBe('op-1');
      expect(f.localidadId).toBe('loc-posadas');
      expect(f.url).toBe('https://x');
      expect(f.requisitos).toBe('DNI');
      expect(f.costos).toBe('$1');
      expect(f.plantillaTitulo).toBe('Obtener la licencia');
      expect(f.organismoNombre).toBeNull();
      expect(f.localidadNombre).toBe('Posadas');
    });
  });

  describe('toOrganismProcedureLocationRequest', () => {
    it('manda SIEMPRE el estado actual que recibe (mitiga R-1)', () => {
      expect(toOrganismProcedureLocationRequest(FORM, 'PUBLICADO').publicationStatus).toBe('PUBLICADO');
      expect(toOrganismProcedureLocationRequest(FORM, 'EN_REVISION').publicationStatus).toBe('EN_REVISION');
    });

    it('canonicaliza el slug y manda los textos vacíos como null', () => {
      const req = toOrganismProcedureLocationRequest(FORM, 'BORRADOR');
      expect(req.slug).toBe('obtener-licencia-posadas');
      expect(req.url).toBeNull();
      expect(req.requirements).toBe('DNI');
      expect(req.costs).toBeNull();
      expect(req.organismProcedureId).toBe('op-1');
      expect(req.locationId).toBe('loc-posadas');
      expect(req.active).toBeTrue();
    });
  });
});
