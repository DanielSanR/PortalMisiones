import { ProcedureTemplateResponseDTO } from '../models/plantilla.dto';
import { PlantillaFormValue } from '../models/plantilla.vm';
import { toPlantillaVM, toProcedureTemplateRequest } from './plantillas.mapper';

const DTO: ProcedureTemplateResponseDTO = {
  id: 'pt-1',
  slugBase: 'obtener-licencia',
  titleBase: 'Obtener la licencia',
  shortDescription: '  ',
  longDescription: 'Descripción',
  modalityId: 'mod-1',
  mainCategoryId: 'cat-2',
  categoryIds: ['cat-1', 'cat-2'],
  tagIds: ['tag-1'],
  lifeEventIds: [],
  recipientIds: ['rec-1'],
  active: true,
};

const FORM: PlantillaFormValue = {
  titulo: '  Obtener la licencia  ',
  slug: 'Obtener la Licencia!',
  resumen: '',
  descripcionLarga: ' Larga ',
  modalidadId: '',
  categoriaPrincipalId: 'cat-1',
  categoriaIds: ['cat-1', 'cat-1', 'cat-2'],
  etiquetaIds: [],
  destinatarioIds: ['rec-1'],
  eventoDeVidaIds: [],
  activa: false,
};

describe('plantillas.mapper', () => {
  describe('toPlantillaVM', () => {
    it('mapea los campos y deja los nombres de catálogo en null', () => {
      const vm = toPlantillaVM(DTO);
      expect(vm.id).toBe('pt-1');
      expect(vm.titulo).toBe('Obtener la licencia');
      expect(vm.slug).toBe('obtener-licencia');
      expect(vm.modalidad).toEqual({ id: 'mod-1', nombre: null });
      expect(vm.categoriaPrincipal).toEqual({ id: 'cat-2', nombre: null });
      expect(vm.categorias.map((c) => c.id)).toEqual(['cat-1', 'cat-2']);
      expect(vm.etiquetas).toEqual([{ id: 'tag-1', nombre: null }]);
      expect(vm.destinatarios).toEqual([{ id: 'rec-1', nombre: null }]);
      expect(vm.eventosDeVida).toEqual([]);
      expect(vm.activa).toBeTrue();
    });

    it('normaliza textos vacíos a null y tolera ids/listas ausentes', () => {
      const vm = toPlantillaVM({
        ...DTO,
        longDescription: null,
        modalityId: null,
        mainCategoryId: null,
        categoryIds: null as unknown as string[],
        active: false,
      });
      expect(vm.resumen).toBeNull();
      expect(vm.descripcionLarga).toBeNull();
      expect(vm.modalidad).toBeNull();
      expect(vm.categoriaPrincipal).toBeNull();
      expect(vm.categorias).toEqual([]);
      expect(vm.activa).toBeFalse();
    });
  });

  describe('toProcedureTemplateRequest', () => {
    it('canonicaliza el slug, recorta textos y manda `active` siempre', () => {
      const req = toProcedureTemplateRequest(FORM);
      expect(req.slugBase).toBe('obtener-la-licencia');
      expect(req.titleBase).toBe('Obtener la licencia');
      expect(req.shortDescription).toBeNull();
      expect(req.longDescription).toBe('Larga');
      expect(req.active).toBeFalse();
      expect(Object.prototype.hasOwnProperty.call(req, 'active')).toBeTrue();
    });

    it('manda ids vacíos como null y las listas sin duplicados (nunca null)', () => {
      const req = toProcedureTemplateRequest(FORM);
      expect(req.modalityId).toBeNull();
      expect(req.mainCategoryId).toBe('cat-1');
      expect(req.categoryIds).toEqual(['cat-1', 'cat-2']);
      expect(req.tagIds).toEqual([]);
      expect(req.recipientIds).toEqual(['rec-1']);
      expect(req.lifeEventIds).toEqual([]);
    });

    it('ida y vuelta: el VM de un request conserva los ids', () => {
      const req = toProcedureTemplateRequest({ ...FORM, activa: true });
      const vm = toPlantillaVM({ id: 'x', ...req });
      expect(vm.slug).toBe(req.slugBase);
      expect(vm.categorias.map((c) => c.id)).toEqual(req.categoryIds);
      expect(vm.categoriaPrincipal?.id).toBe('cat-1');
      expect(vm.activa).toBeTrue();
    });
  });
});
