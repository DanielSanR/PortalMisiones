import { OrganismProcedureLocationResponseDTO } from '../models/ficha-local.dto';
import { FichaLocalFormValue } from '../models/ficha-local.vm';
import { toFichaLocal, toOrganismProcedureLocationRequest } from './fichas-locales.mapper';

/** Response real de `dev` @ `586b670` (`toResponse`). `satisfies`: los campos de contenido quedan como `string`. */
const DTO = {
  id: 'fl-1',
  organismProcedureId: 'op-1',
  locationId: 'loc-posadas',
  slug: 'obtener-licencia-posadas',
  url: 'https://www.posadas.gob.ar/licencias',
  requirements: 'DNI vigente.\nLibre deuda.',
  costs: '$25.000',
  publicationStatus: 'PUBLICADO',
  active: true,
  currentVersionNumber: 3,
} satisfies OrganismProcedureLocationResponseDTO;

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
    it('mapea el response completo: adopción, localidad, contenido, estado y versión', () => {
      expect(toFichaLocal(DTO)).toEqual({
        id: 'fl-1',
        slug: 'obtener-licencia-posadas',
        estado: 'PUBLICADO',
        activa: true,
        version: 3,
        adopcionId: 'op-1',
        localidadId: 'loc-posadas',
        url: 'https://www.posadas.gob.ar/licencias',
        requisitos: 'DNI vigente.\nLibre deuda.',
        costos: '$25.000',
      });
    });

    it('los textos opcionales que vienen en null quedan en null', () => {
      const f = toFichaLocal({ ...DTO, url: null, requirements: null, costs: null });
      expect(f.url).toBeNull();
      expect(f.requisitos).toBeNull();
      expect(f.costos).toBeNull();
    });
  });

  describe('toFichaLocal · compatibilidad con un backend anterior a 586b670 (response de 5 campos)', () => {
    const VIEJO: OrganismProcedureLocationResponseDTO = {
      id: 'fl-1', slug: 'obtener-licencia-posadas', publicationStatus: 'PUBLICADO', active: true, currentVersionNumber: 3,
    };

    it('sin adopción ni localidad la ficha sale marcada sinContenido, con los ids vacíos y los textos en null', () => {
      const ficha = toFichaLocal(VIEJO);
      expect(ficha.sinContenido).toBeTrue();
      expect(ficha.adopcionId).toBe('');
      expect(ficha.localidadId).toBe('');
      expect([ficha.url, ficha.requisitos, ficha.costos]).toEqual([null, null, null]);
      expect(ficha.estado).toBe('PUBLICADO');
      expect(ficha.version).toBe(3);
    });

    it('con el response completo no lleva la marca', () => {
      expect('sinContenido' in toFichaLocal(DTO)).toBeFalse();
    });
  });

  describe('toOrganismProcedureLocationRequest', () => {
    it('manda los cuatro obligatorios del backend (adopción, localidad, slug, activa)', () => {
      const req = toOrganismProcedureLocationRequest(FORM);
      expect(req.organismProcedureId).toBe('op-1');
      expect(req.locationId).toBe('loc-posadas');
      expect(req.slug).toBe('obtener-licencia-posadas');
      expect(req.active).toBeTrue();
    });

    it('canonicaliza el slug y manda los textos vacíos como null', () => {
      const req = toOrganismProcedureLocationRequest(FORM);
      expect(req.url).toBeNull();
      expect(req.requirements).toBe('DNI');
      expect(req.costs).toBeNull();
    });

    it('con conservarSlug (edición sin tocarlo) el slug viaja tal cual se leyó, sin re-canonicalizar', () => {
      const heredado = 'Obtener_Licencia.POSADAS';
      expect(toOrganismProcedureLocationRequest({ ...FORM, slug: heredado, conservarSlug: true }).slug).toBe(heredado);
      // Sin la marca (alta, o slug editado) se canonicaliza como siempre.
      expect(toOrganismProcedureLocationRequest({ ...FORM, slug: heredado }).slug).not.toBe(heredado);
      // La marca no viaja al backend.
      expect(Object.keys(toOrganismProcedureLocationRequest({ ...FORM, conservarSlug: true }))).not.toContain('conservarSlug');
    });

    it('no manda publicationStatus: el backend lo ignora (guardar no cambia el estado)', () => {
      expect(Object.keys(toOrganismProcedureLocationRequest(FORM))).not.toContain('publicationStatus');
    });
  });

  describe('roundtrip GET → PUT', () => {
    it('lo leído, sin tocar, viaja completo en el request (el PUT es total: nada se pierde)', () => {
      const ficha = toFichaLocal(DTO);
      // Lo que arma el form de edición a partir de la ficha leída.
      const form: FichaLocalFormValue = {
        adopcionId: ficha.adopcionId,
        localidadId: ficha.localidadId,
        slug: ficha.slug,
        url: ficha.url ?? '',
        requisitos: ficha.requisitos ?? '',
        costos: ficha.costos ?? '',
        activa: ficha.activa,
      };
      expect(toOrganismProcedureLocationRequest(form)).toEqual({
        organismProcedureId: DTO.organismProcedureId,
        locationId: DTO.locationId,
        slug: DTO.slug,
        url: DTO.url,
        requirements: DTO.requirements,
        costs: DTO.costs,
        active: DTO.active,
      });
    });

    it('una ficha sin URL, requisitos ni costos vuelve con esos campos en null (no como texto vacío)', () => {
      const ficha = toFichaLocal({ ...DTO, url: null, requirements: null, costs: null, active: false });
      const req = toOrganismProcedureLocationRequest({
        adopcionId: ficha.adopcionId, localidadId: ficha.localidadId, slug: ficha.slug,
        url: ficha.url ?? '', requisitos: ficha.requisitos ?? '', costos: ficha.costos ?? '', activa: ficha.activa,
      });
      expect(req.url).toBeNull();
      expect(req.requirements).toBeNull();
      expect(req.costs).toBeNull();
      expect(req.active).toBeFalse();
    });
  });
});
