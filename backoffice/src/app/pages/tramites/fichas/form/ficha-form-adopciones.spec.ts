import { FormGroup } from '@angular/forms';
import { firstValueFrom, of, throwError } from 'rxjs';
import { FichaAdopcionResumen, FichaFormData } from '@features/fichas-locales';
import {
  SIN_ELECCION, arbolDeAdopciones, eleccionTrasLeer, leerAdopcion, motivoSinAdopcion, sinTramite, sinVigentes, soltarLocalidad,
} from './ficha-form-adopciones';
import { FichaForm, controlesDeFicha } from './ficha-form-campos';

const VIGENTE: FichaAdopcionResumen = {
  id: 'a-1', plantillaTitulo: 'Obtener la licencia de conducir', plantillaSlug: 'licencia', organismoNombre: 'Municipalidad de Posadas',
  habilitada: true, vigente: true, motivoNoVigente: null, vigenteDesde: new Date(2026, 0, 1), vigenteHasta: null,
};

const VENCIDA: FichaAdopcionResumen = {
  ...VIGENTE, id: 'a-2', plantillaTitulo: null, organismoNombre: null, plantillaSlug: null,
  vigente: false, motivoNoVigente: 'vencida', vigenteHasta: new Date(2026, 5, 30),
};

const DATOS: FichaFormData = {
  ficha: null,
  adopcion: VIGENTE,
  localidades: [{ id: 'l-1', nombre: 'Posadas', departamentoNombre: 'Capital' }],
  ocupadas: { localidadIds: ['l-1'], localidadIdsDesactivadas: ['l-1'], slugs: ['licencia-posadas'] },
};

describe('trámite del organismo de una ficha nueva', () => {
  describe('buscador', () => {
    it('antes de leer los trámites está vacío y sin cargar', () => {
      const arbol = arbolDeAdopciones(null);
      expect(arbol.nodes).toEqual([]);
      expect(arbol.loaded).toBeFalse();
    });

    it('cada trámite es una opción con su título, el organismo debajo y palabras para buscarlo', () => {
      const [nodo] = arbolDeAdopciones([VIGENTE]).nodes;
      expect(nodo).toEqual(jasmine.objectContaining({
        id: 'a-1', label: 'Obtener la licencia de conducir', meta: 'Municipalidad de Posadas', parentId: null,
        keywords: 'Municipalidad de Posadas licencia',
      }));
      expect(nodo.disabledReason).withContext('vigente: se puede elegir').toBeUndefined();
      expect(arbolDeAdopciones([VIGENTE]).loaded).toBeTrue();
    });

    it('el que no está vigente se muestra igual, no elegible y con el motivo', () => {
      const [nodo] = arbolDeAdopciones([VENCIDA]).nodes;
      expect(nodo.disabledReason).toContain('Venció');
      expect(nodo.label).toBe('Trámite sin nombre disponible');
      expect(nodo.keywords).toBe('');
    });

    it('avisa que no hay qué elegir solo si hay trámites y ninguno está vigente', () => {
      expect(sinVigentes([VENCIDA])).toBeTrue();
      expect(sinVigentes([VENCIDA, VIGENTE])).toBeFalse();
      expect(sinVigentes([])).toBeFalse();
    });
  });

  describe('lectura del trámite elegido', () => {
    it('sin trámite elegido no lee nada', async () => {
      const leer = jasmine.createSpy('leer');
      expect(await firstValueFrom(leerAdopcion('', leer))).toBeNull();
      expect(leer).not.toHaveBeenCalled();
    });

    it('entrega lo leído del trámite', async () => {
      const leer = jasmine.createSpy('leer').and.returnValue(of(DATOS));
      expect(await firstValueFrom(leerAdopcion('a-1', leer))).toBe(DATOS);
      expect(leer).toHaveBeenCalledOnceWith('a-1');
    });

    it('distingue el trámite que ya no existe (404) de un fallo que se puede reintentar', async () => {
      expect(await firstValueFrom(leerAdopcion('a-1', () => throwError(() => ({ status: 404 }))))).toBe('inexistente');
      expect(await firstValueFrom(leerAdopcion('a-1', () => throwError(() => ({ status: 0 }))))).toBe('fallo');
    });

    it('leído y vigente: quedan sus datos y nada que avisar', () => {
      expect(eleccionTrasLeer(DATOS, 'a-1')).toEqual({ datos: DATOS, eleccion: SIN_ELECCION });
    });

    it('leído pero ya no vigente: se avisa y no se sigue', () => {
      const lectura: FichaFormData = { ...DATOS, adopcion: VENCIDA };
      expect(eleccionTrasLeer(lectura, 'a-2').eleccion).toEqual({ ...SIN_ELECCION, noVigente: true });
    });

    it('no se pudo leer: sin datos, y se distingue "ya no existe" de "falló"', () => {
      expect(eleccionTrasLeer('inexistente', 'a-1')).toEqual({ datos: null, eleccion: { ...SIN_ELECCION, inexistente: true } });
      expect(eleccionTrasLeer('fallo', 'a-1')).toEqual({ datos: null, eleccion: { ...SIN_ELECCION, fallo: true } });
    });

    it('si mientras tanto se quitó el trámite, la lectura no cuenta', () => {
      expect(eleccionTrasLeer(DATOS, '')).toEqual({ datos: null, eleccion: SIN_ELECCION });
    });

    it('el motivo por el que todavía no se puede guardar dice qué hacer', () => {
      expect(motivoSinAdopcion(SIN_ELECCION)).toBeNull();
      expect(motivoSinAdopcion({ ...SIN_ELECCION, cargando: true })).toContain('esperá');
      expect(motivoSinAdopcion({ ...SIN_ELECCION, inexistente: true })).toBe('ya no está disponible: elegí otro');
      expect(motivoSinAdopcion({ ...SIN_ELECCION, noVigente: true })).toBe('ya no está vigente: elegí otro');
      expect(motivoSinAdopcion({ ...SIN_ELECCION, fallo: true })).toContain('reintentá');
    });
  });

  describe('al cambiar de trámite', () => {
    const formCon = (localidadId: string, slug: string): FichaForm => {
      const form: FichaForm = new FormGroup(controlesDeFicha(() => ({ isEdit: false, datos: null })));
      form.controls.localidadId.setValue(localidadId);
      form.controls.localidadId.markAsTouched();
      form.controls.localidadId.markAsDirty();
      form.controls.slug.setValue(slug);
      return form;
    };

    it('lo leído del trámite anterior deja de valer, pero los catálogos y los slugs ocupados siguen', () => {
      expect(sinTramite(DATOS)).toEqual({
        ...DATOS, adopcion: null, ocupadas: { localidadIds: [], localidadIdsDesactivadas: [], slugs: ['licencia-posadas'] },
      });
    });

    it('la localidad queda vacía, bloqueada y sin marca de error, y el slug sugerido se vacía con ella', () => {
      const form = formCon('l-1', 'licencia-posadas');

      soltarLocalidad(form, false);

      const { localidadId, slug } = form.controls;
      expect(localidadId.value).toBe('');
      expect(localidadId.disabled).toBeTrue();
      expect(localidadId.touched).toBeFalse();
      expect(localidadId.pristine).toBeTrue();
      expect(slug.value).toBe('');
    });

    it('un slug escrito a mano no se pierde', () => {
      const form = formCon('l-1', 'mi-slug');

      soltarLocalidad(form, true);

      expect(form.controls.slug.value).toBe('mi-slug');
    });
  });
});
