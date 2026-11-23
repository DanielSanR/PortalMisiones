import { FieldConfig } from '@core/models/field.interface';
import { PlantillaCatalogos, PlantillaVM } from '@features/plantillas';
import {
  MAX_TEXTO_CORTO, ValorDePlantilla, aPlantillaFormValue, camposDePlantilla, claveDeCampos, conSeleccionados, leerValorDePlantilla,
  panelesDePlantilla, resumenDePlantilla, totalElegidas, valorInicialDePlantilla,
} from './plantilla-campos';

const CATALOGOS: PlantillaCatalogos = {
  modalidades: [{ id: 'm-1', nombre: 'Presencial' }],
  categorias: [{ id: 'c-1', nombre: 'Salud' }, { id: 'c-2', nombre: 'Educación' }, { id: 'c-3', nombre: 'Transporte' }],
  etiquetas: [{ id: 'e-1', nombre: 'Gratuito' }],
  destinatarios: [{ id: 'd-1', nombre: 'Jóvenes' }],
  eventosDeVida: [{ id: 'v-1', nombre: 'Nacimiento' }],
  noDisponibles: [],
};

const PLANTILLA: PlantillaVM = {
  id: 'p-1',
  titulo: 'Obtener la licencia',
  slug: 'obtener-licencia',
  resumen: 'Para manejar.',
  descripcionLarga: 'Texto largo',
  modalidad: { id: 'm-1', nombre: 'Presencial' },
  categoriaPrincipal: { id: 'c-1', nombre: 'Salud' },
  categorias: [{ id: 'c-1', nombre: 'Salud' }, { id: 'c-2', nombre: 'Educación' }],
  etiquetas: [{ id: 'e-1', nombre: 'Gratuito' }],
  destinatarios: [],
  eventosDeVida: [],
  activa: true,
};

const SIN_CATEGORIAS = { categoriaIds: [], principal: '' };

describe('plantilla-campos', () => {
  const campo = (campos: FieldConfig[], nombre: string): FieldConfig => campos.find((c) => c.name === nombre)!;
  const nombres = (c: FieldConfig): string[] => (c.options ?? []).map((o) => o.name);

  describe('valorInicialDePlantilla', () => {
    it('alta: todo vacío y activa', () => {
      expect(valorInicialDePlantilla(null)).toEqual({
        titulo: '', slug: '', resumen: '', descripcion: '', modalidad: '', categoriaIds: [], principal: '',
        etiquetaIds: [], destinatarioIds: [], eventoDeVidaIds: [], activa: true,
      });
    });

    it('edición: toma los ids de la plantilla, con los nombres de campo del formulario', () => {
      expect(valorInicialDePlantilla(PLANTILLA)).toEqual({
        titulo: 'Obtener la licencia', slug: 'obtener-licencia', resumen: 'Para manejar.', descripcion: 'Texto largo',
        modalidad: 'm-1', categoriaIds: ['c-1', 'c-2'], principal: 'c-1',
        etiquetaIds: ['e-1'], destinatarioIds: [], eventoDeVidaIds: [], activa: true,
      });
    });

    it('los nulos de la plantilla pasan a vacío', () => {
      const valor = valorInicialDePlantilla({ ...PLANTILLA, resumen: null, descripcionLarga: null, modalidad: null, categoriaPrincipal: null, activa: false });
      expect([valor.resumen, valor.descripcion, valor.modalidad, valor.principal, valor.activa]).toEqual(['', '', '', '', false]);
    });
  });

  describe('aPlantillaFormValue', () => {
    it('renombra los campos y manda null la modalidad y la principal sin elegir; no recorta ni canonicaliza', () => {
      expect(aPlantillaFormValue({ ...valorInicialDePlantilla(null), titulo: '  Obtener  ', slug: 'Mi Slug', descripcion: 'Larga' })).toEqual({
        titulo: '  Obtener  ', slug: 'Mi Slug', resumen: '', descripcionLarga: 'Larga', modalidadId: null, categoriaPrincipalId: null,
        categoriaIds: [], etiquetaIds: [], destinatarioIds: [], eventoDeVidaIds: [], activa: true,
      });
    });

    it('ida y vuelta: el valor inicial de una plantilla viaja como la plantilla', () => {
      expect(aPlantillaFormValue(valorInicialDePlantilla(PLANTILLA))).toEqual({
        titulo: 'Obtener la licencia', slug: 'obtener-licencia', resumen: 'Para manejar.', descripcionLarga: 'Texto largo',
        modalidadId: 'm-1', categoriaPrincipalId: 'c-1', categoriaIds: ['c-1', 'c-2'], etiquetaIds: ['e-1'],
        destinatarioIds: [], eventoDeVidaIds: [], activa: true,
      });
    });

    it('un valor crudo incompleto se lee como vacío, y "activa" solo se apaga con false', () => {
      expect(leerValorDePlantilla({ titulo: null, categoriaIds: 'x' })).toEqual(valorInicialDePlantilla(null));
      expect(leerValorDePlantilla({ activa: false }).activa).toBeFalse();
    });
  });

  describe('conSeleccionados', () => {
    it('agrega lo elegido que no está en el catálogo como "No disponible (id)", una sola vez y al final', () => {
      const catalogos = conSeleccionados(CATALOGOS, {
        ...PLANTILLA,
        modalidad: { id: 'modal999-x', nombre: null },
        categorias: [{ id: 'c-1', nombre: 'Salud' }, { id: 'borrada1-y', nombre: null }],
        categoriaPrincipal: { id: 'borrada1-y', nombre: null },
      });

      expect(catalogos.modalidades).toEqual([{ id: 'm-1', nombre: 'Presencial' }, { id: 'modal999-x', nombre: 'No disponible (modal999)' }]);
      expect(catalogos.categorias.map((c) => c.nombre)).toEqual(['Salud', 'Educación', 'Transporte', 'No disponible (borrada1)']);
    });

    it('no toca los catálogos que ya tienen todo lo elegido', () => {
      expect(conSeleccionados(CATALOGOS, PLANTILLA)).toEqual(CATALOGOS);
    });
  });

  describe('camposDePlantilla', () => {
    it('los `name` dan los ids que usan los specs y el e2e', () => {
      expect(camposDePlantilla(CATALOGOS, SIN_CATEGORIAS, true).map((c) => c.name)).toEqual([
        'titulo', 'slug', 'resumen', 'descripcion', 'modalidad', 'activa',
        'categoriaIds', 'principal', 'etiquetaIds', 'destinatarioIds', 'eventoDeVidaIds',
      ]);
    });

    it('título y slug son obligatorios y de hasta 255; el resto es opcional', () => {
      const campos = camposDePlantilla(CATALOGOS, SIN_CATEGORIAS, false);
      ['titulo', 'slug'].forEach((nombre) => {
        expect(campo(campos, nombre).validations?.required).withContext(nombre).toBeTrue();
        expect(campo(campos, nombre).validations?.maxLength).withContext(nombre).toBe(MAX_TEXTO_CORTO);
      });
      ['resumen', 'descripcion', 'modalidad', 'principal'].forEach((nombre) => {
        expect(campo(campos, nombre).opcional).withContext(nombre).toBeTrue();
        expect(campo(campos, nombre).validations?.required).withContext(nombre).toBeFalsy();
      });
    });

    it('alta: el slug sigue al título y lleva el bloque "Después de crearla"', () => {
      const campos = camposDePlantilla(CATALOGOS, SIN_CATEGORIAS, false);
      const slug = campo(campos, 'slug');

      expect(slug.derivado?.de).toBe('titulo');
      expect(slug.derivado?.seguir).toBeTrue();
      expect(slug.derivado?.accion).toBe('Desde el título');
      expect(slug.derivado?.transform('  Obtener el DNI de Ñandúes! ')).toBe('obtener-el-dni-de-nandues');
      expect(slug.hint).toBe('Se arma solo desde el título; podés editarlo. Es único entre todas las plantillas.');
      expect(campo(campos, 'despues').type).toBe('vista');
    });

    it('edición: el slug no sigue al título (cambiarlo es deliberado) y no hay "Después de crearla"', () => {
      const campos = camposDePlantilla(CATALOGOS, SIN_CATEGORIAS, true);

      expect(campo(campos, 'slug').derivado?.seguir).toBeFalse();
      expect(campo(campos, 'slug').hint).toBe('Cambiarlo cambia la dirección pública del trámite. Es único entre todas las plantillas.');
      expect(campo(campos, 'despues')).toBeUndefined();
    });

    it('el slug anticipa cómo se guarda y rechaza el que no deja letras ni números', () => {
      const slug = campo(camposDePlantilla(CATALOGOS, SIN_CATEGORIAS, false), 'slug');

      expect(slug.mono).toBeTrue();
      expect(slug.preview?.label).toBe('Se guardará como:');
      expect(slug.preview?.transform('Mi Slug Ñandú')).toBe('mi-slug-nandu');
      expect(slug.validations?.validar?.('¡¡¡')).toBe('Tiene que tener letras o números');
      expect(slug.validations?.validar?.('mi-slug')).toBeNull();
      // Vacío o solo espacios: lo informa `required`, no esta regla.
      expect(slug.validations?.validar?.('   ')).toBeNull();
    });

    it('modalidad y catálogos: "Sin modalidad" primero y las opciones en el orden del catálogo', () => {
      const campos = camposDePlantilla(CATALOGOS, SIN_CATEGORIAS, false);

      expect(campo(campos, 'modalidad').options).toEqual([{ id: '', name: 'Sin modalidad' }, { id: 'm-1', name: 'Presencial' }]);
      expect(nombres(campo(campos, 'categoriaIds'))).toEqual(['Salud', 'Educación', 'Transporte']);
      expect(campo(campos, 'categoriaIds').seleccion).toEqual({ nombre: 'categorías', textoVacio: 'Ninguna categoría elegida.' });
      expect(campo(campos, 'eventoDeVidaIds').seleccion).toEqual({ nombre: 'eventos de vida', textoVacio: 'Ningún evento de vida elegido.' });
      expect(campo(campos, 'categoriaIds').value).toEqual([]);
    });

    it('"Activa" avisa la consecuencia solo al apagarla', () => {
      const activa = campo(camposDePlantilla(CATALOGOS, SIN_CATEGORIAS, false), 'activa');

      expect(activa.aviso?.(true)).toBeNull();
      expect(activa.aviso?.(false)?.texto).toBe('Desactivada, deja de aparecer en el listado de plantillas y no se puede adoptar.');
    });

    describe('categoría principal', () => {
      const principal = (categoriaIds: string[], elegida = ''): FieldConfig =>
        campo(camposDePlantilla(CATALOGOS, { categoriaIds, principal: elegida }, true), 'principal');

      it('sin categorías ni principal va deshabilitada y dice cómo destrabarla', () => {
        expect(principal([]).disabled).toBeTrue();
        expect(principal([]).hint).toBe('Elegí primero al menos una categoría.');
        expect(nombres(principal([]))).toEqual(['Sin categoría principal']);
      });

      it('ofrece solo las categorías elegidas, en el orden del catálogo', () => {
        expect(principal(['c-3', 'c-1']).disabled).toBeFalse();
        expect(principal(['c-3', 'c-1']).hint).toBe('Se elige entre las categorías de la plantilla.');
        expect(nombres(principal(['c-3', 'c-1']))).toEqual(['Sin categoría principal', 'Salud', 'Transporte']);
      });

      it('la principal actual se sigue listando aunque le quiten su categoría, y el campo queda habilitado', () => {
        expect(nombres(principal(['c-2'], 'c-1'))).toEqual(['Sin categoría principal', 'Salud', 'Educación']);
        expect(principal([], 'c-1').disabled).toBeFalse();
      });

      it('tiene que ser una de las categorías elegidas (se reevalúa al cambiar las categorías)', () => {
        const regla = principal(['c-2'], 'c-1').validations!.validarCon!;

        expect(regla.campos).toEqual(['categoriaIds']);
        expect(regla.validar('c-1', { categoriaIds: ['c-2'] })).toBe('Tiene que ser una de las categorías elegidas');
        expect(regla.validar('c-2', { categoriaIds: ['c-2'] })).toBeNull();
        expect(regla.validar('', { categoriaIds: [] })).toBeNull();
      });
    });

    it('`claveDeCampos` cambia solo con las categorías o la principal', () => {
      const base = valorInicialDePlantilla(PLANTILLA);

      const otroTitulo: ValorDePlantilla = { ...base, titulo: 'Otro', etiquetaIds: [] };
      expect(claveDeCampos(otroTitulo)).toBe(claveDeCampos(base));
      expect(claveDeCampos({ ...base, categoriaIds: ['c-1'] })).not.toBe(claveDeCampos(base));
      expect(claveDeCampos({ ...base, principal: '' })).not.toBe(claveDeCampos(base));
    });
  });

  describe('panelesDePlantilla', () => {
    it('datos con "Activa" al pie, y Clasificación por grupos con la principal pegada a las categorías', () => {
      const [datos, clasificacion] = panelesDePlantilla(true, '4 opciones elegidas');

      expect(datos).toEqual({
        id: 'plantform-datos', titulo: 'Datos de la plantilla', subtitulo: 'Guardar reemplaza la plantilla completa',
        campos: ['titulo', 'slug', 'resumen', 'descripcion', 'modalidad'], opciones: ['activa'],
      });
      expect(clasificacion.lateral).toBeTrue();
      expect(clasificacion.cuerpo).toBe('grupos');
      expect(clasificacion.total).toBe('4 opciones elegidas');
      expect(clasificacion.campos).toEqual([['categoriaIds', 'principal'], 'etiquetaIds', 'destinatarioIds', 'eventoDeVidaIds']);
    });

    it('alta: otro subtítulo y "Después de crearla" como último grupo', () => {
      const [datos, clasificacion] = panelesDePlantilla(false, '0 opciones elegidas');

      expect(datos.subtitulo).toBe('Completá los datos para crear la plantilla');
      expect(clasificacion.campos[clasificacion.campos.length - 1]).toBe('despues');
    });

    it('todo campo con control figura en algún panel (lo que no figura no se dibuja)', () => {
      [true, false].forEach((esEdicion) => {
        const enPaneles = panelesDePlantilla(esEdicion, '').flatMap((panel) => [...panel.campos.flat(), ...(panel.opciones ?? [])]);
        expect(enPaneles.sort()).toEqual(camposDePlantilla(CATALOGOS, SIN_CATEGORIAS, esEdicion).map((c) => c.name).sort());
      });
    });
  });

  describe('totalElegidas', () => {
    it('suma los cuatro catálogos, en singular con una sola; la principal no cuenta', () => {
      expect(totalElegidas(valorInicialDePlantilla(null))).toBe('0 opciones elegidas');
      const conPrincipal: ValorDePlantilla = { ...valorInicialDePlantilla(null), categoriaIds: ['c-1'], principal: 'c-1' };
      expect(totalElegidas(conPrincipal)).toBe('1 opción elegida');
      expect(totalElegidas(valorInicialDePlantilla(PLANTILLA))).toBe('3 opciones elegidas');
    });
  });

  describe('resumenDePlantilla', () => {
    it('alta vacía: sin título, membrete con los "sin …" y todo lo recomendado por completar', () => {
      const resumen = resumenDePlantilla(valorInicialDePlantilla(null), CATALOGOS);

      expect(resumen.titulo).toBe('');
      expect(resumen.activa).toBeTrue();
      expect(resumen.membrete.map((d) => d.texto)).toEqual(['sin-slug', 'Sin modalidad', 'Sin categoría principal']);
      expect(resumen.recomendadosCompletos).toBeFalse();
      expect(resumen.recomendado).toBe('Recomendado: falta resumen, modalidad y categoría principal');
    });

    it('resuelve los nombres con los catálogos y recorta el título', () => {
      const resumen = resumenDePlantilla({ ...valorInicialDePlantilla(PLANTILLA), titulo: '  Obtener  ' }, CATALOGOS);

      expect(resumen.titulo).toBe('Obtener');
      expect(resumen.membrete.map((d) => d.texto)).toEqual(['obtener-licencia', 'Presencial', 'Salud']);
      expect(resumen.recomendadosCompletos).toBeTrue();
      expect(resumen.recomendado).toBe('Datos recomendados: completos');
    });
  });
});
