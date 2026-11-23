import { FichaAdopcionResumen, FichaFormData, FichaLocalVM } from '@features/fichas-locales';
import { TEXTOS_FICHA_INEXISTENTE } from '../ficha-save-error';
import {
  aErrorDeCarga, aVista, avisoDeNoVigente, ayudaDelPie, esSlugHeredado, slugPrevisto, slugSugerido, textoDeGuardada, textoDeGuardar,
} from './ficha-form-vista';

const ADOPCION: FichaAdopcionResumen = {
  id: 'a-1', plantillaTitulo: 'Obtener la licencia de conducir', plantillaSlug: 'licencia', organismoNombre: 'Municipalidad de Posadas',
  habilitada: true, vigente: true, motivoNoVigente: null, vigenteDesde: new Date(2026, 0, 1), vigenteHasta: null,
};

const FICHA: FichaLocalVM = {
  id: 'f-1', slug: 'Licencia_Vieja', estado: 'BORRADOR', activa: true, version: 1,
  adopcionId: 'a-1', localidadId: 'l-9', url: null, requisitos: null, costos: null,
  plantillaId: 'p-1', plantillaTitulo: 'Título de la ficha', organismoId: 'o-1', organismoNombre: 'Organismo de la ficha',
  localidadNombre: 'Localidad de la ficha',
};

const DATOS: FichaFormData = {
  ficha: null,
  adopcion: ADOPCION,
  localidades: [{ id: 'l-1', nombre: 'Oberá', departamentoNombre: 'Oberá' }],
  ocupadas: { localidadIds: [], localidadIdsDesactivadas: [], slugs: [] },
};

const VALOR = { adopcion: '', localidadId: 'l-1', slug: 'Licencia Oberá', url: '', requisitos: '', costos: '', activa: true };

describe('vista del formulario de ficha', () => {
  describe('membrete e indicador', () => {
    it('se arma con el trámite leído, la localidad elegida y el slug como se va a guardar', () => {
      expect(aVista(VALOR, DATOS, false, false)).toEqual({
        titulo: 'Obtener la licencia de conducir', sinAdopcion: false, organismo: 'Municipalidad de Posadas',
        localidad: 'Oberá', slug: 'licencia-obera', activa: true,
        recomendadosCompletos: false, recomendado: 'Recomendado: falta requisitos, costos y url',
      });
    });

    it('sin el trámite leído usa los nombres de la ficha; y sin nada, queda vacío', () => {
      const vista = aVista({ ...VALOR, localidadId: 'l-9' }, { ...DATOS, adopcion: null, ficha: FICHA }, false, false);
      expect(vista.titulo).toBe('Título de la ficha');
      expect(vista.organismo).toBe('Organismo de la ficha');
      expect(vista.localidad).toBe('Localidad de la ficha');

      const vacia = aVista({ ...VALOR, localidadId: '' }, null, true, false);
      expect(vacia).toEqual(jasmine.objectContaining({ titulo: '', organismo: '', localidad: '', sinAdopcion: true }));
    });

    it('el slug que se conserva se muestra tal cual, sin canonicalizar', () => {
      expect(aVista({ ...VALOR, slug: 'Licencia_Vieja' }, DATOS, false, true).slug).toBe('Licencia_Vieja');
    });

    it('con requisitos, costos y URL los datos recomendados están completos (los espacios no cuentan)', () => {
      const completo = { ...VALOR, requisitos: 'DNI', costos: 'Gratis', url: 'https://x.gob.ar' };
      expect(aVista(completo, DATOS, false, false).recomendadosCompletos).toBeTrue();
      expect(aVista({ ...completo, costos: '   ' }, DATOS, false, false).recomendadosCompletos).toBeFalse();
    });
  });

  describe('slug', () => {
    it('se sugiere con el slug de la plantilla y la localidad; sin localidad no hay sugerencia', () => {
      expect(slugSugerido(DATOS, 'l-1')).toBe('licencia-obera');
      expect(slugSugerido({ ...DATOS, adopcion: null }, 'l-1')).toBe('obera');
      expect(slugSugerido(DATOS, '')).toBe('');
      expect(slugSugerido(null, 'l-1')).toBe('');
    });

    it('avisa cómo se va a guardar solo si difiere de lo tipeado y no se conserva', () => {
      expect(slugPrevisto('Licencia Oberá', false)).toBe('licencia-obera');
      expect(slugPrevisto('licencia-obera', false)).toBeNull();
      expect(slugPrevisto('¡¡¡', false)).toBeNull();
      expect(slugPrevisto('Licencia_Vieja', true)).toBeNull();
    });

    it('un slug leído que no sigue el formato actual es heredado', () => {
      expect(esSlugHeredado('Licencia_Vieja')).toBeTrue();
      expect(esSlugHeredado('licencia-vieja')).toBeFalse();
      expect(esSlugHeredado('')).toBeFalse();
    });
  });

  describe('error de carga', () => {
    it('la ficha que no existe no ofrece reintentar y vuelve al listado de fichas', () => {
      expect(aErrorDeCarga({ status: 404 }, true, true)).toEqual({ definitivo: true, volverA: 'fichas', ...TEXTOS_FICHA_INEXISTENTE });
    });

    it('el alta con un trámite fijo que no existe vuelve a los trámites del organismo', () => {
      const error = aErrorDeCarga({ status: 404 }, false, false);
      expect(error.definitivo).toBeTrue();
      expect(error.volverA).toBe('adopciones');
      expect(error.titulo).toBe('Ese trámite del organismo no existe');
    });

    it('cualquier otro fallo se puede reintentar y dice qué se estaba cargando', () => {
      expect(aErrorDeCarga({ status: 500 }, true, true))
        .toEqual(jasmine.objectContaining({ definitivo: false, volverA: 'fichas', titulo: 'No pudimos cargar la ficha' }));
      expect(aErrorDeCarga({ status: 0 }, false, true).titulo).toBe('No pudimos cargar el formulario');
    });
  });

  describe('textos', () => {
    it('el aviso de trámite no vigente dice el motivo y qué no se va a poder hacer', () => {
      expect(avisoDeNoVigente('vencida', true)).toContain('ya venció: no vas a poder guardar cambios en esta ficha');
      expect(avisoDeNoVigente('programada', false)).toContain('todavía no empezó a regir: no vas a poder crearle fichas');
    });

    it('el botón y la ayuda del pie dicen lo que va a pasar', () => {
      expect(textoDeGuardar(false, false)).toBe('Crear ficha');
      expect(textoDeGuardar(true, false)).toBe('Guardar cambios');
      expect(textoDeGuardar(true, true)).toBe('Guardar y despublicar');
      expect(ayudaDelPie(false, false, false)).toBe('La ficha se crea en borrador.');
      expect(ayudaDelPie(true, true, false)).toBe('Al guardar, la ficha se despublica.');
      expect(ayudaDelPie(true, false, true)).toBe('Sin cambios para guardar.');
      expect(ayudaDelPie(true, false, false)).toBe('Guardar no cambia el estado de publicación.');
    });

    it('el aviso de éxito dice cómo quedó la ficha', () => {
      expect(textoDeGuardada(false, FICHA, false)).toContain('Ficha creada en borrador');
      expect(textoDeGuardada(true, FICHA, true)).toContain('además se despublicó');
      expect(textoDeGuardada(true, { ...FICHA, activa: false }, false)).toBe('Cambios guardados. La ficha está desactivada');
      expect(textoDeGuardada(true, { ...FICHA, estado: 'PUBLICADO' }, false)).toBe('Cambios guardados. Ya se ven en el portal');
      expect(textoDeGuardada(true, FICHA, false)).toBe('Cambios guardados');
    });
  });
});
