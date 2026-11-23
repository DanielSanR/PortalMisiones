import {
  FichasOcupadas, errorDeLocalidad, errorDeUrl, reactivacionDuplicada, slugRepetido, slugSinContenido,
} from './ficha-validaciones';

const OCUPADAS: FichasOcupadas = {
  localidadIds: ['l-1', 'l-2'], localidadIdsDesactivadas: ['l-2'], slugs: ['slug-en-uso'],
};

describe('validaciones de la ficha', () => {
  describe('slug', () => {
    it('un slug que queda vacío al canonicalizarlo no sirve', () => {
      expect(slugSinContenido('¡¡¡')).toBeTrue();
    });

    it('el slug vacío o solo con espacios no cuenta: lo cubre el obligatorio', () => {
      expect(slugSinContenido('')).toBeFalse();
      expect(slugSinContenido('   ')).toBeFalse();
    });

    it('un slug con letras sirve aunque no esté en formato canónico', () => {
      expect(slugSinContenido('Obtener Licencia')).toBeFalse();
    });

    it('se compara canonicalizado con los slugs de las demás fichas', () => {
      expect(slugRepetido('Slug en USO', OCUPADAS)).toBeTrue();
      expect(slugRepetido('slug-libre', OCUPADAS)).toBeFalse();
      expect(slugRepetido('', OCUPADAS)).toBeFalse();
    });
  });

  describe('URL', () => {
    it('vacía es válida: es opcional', () => {
      expect(errorDeUrl('')).toBeNull();
      expect(errorDeUrl('   ')).toBeNull();
    });

    it('acepta una URL absoluta http o https', () => {
      expect(errorDeUrl('https://www.misiones.gob.ar/tramites?id=1')).toBeNull();
      expect(errorDeUrl('HTTP://misiones.gob.ar')).toBeNull();
    });

    it('sin http(s):// dice que falta el esquema', () => {
      expect(errorDeUrl('www.misiones.gob.ar')).toBe('urlEsquema');
      expect(errorDeUrl('ftp://misiones.gob.ar')).toBe('urlEsquema');
    });

    it('con espacios en el medio dice que tiene espacios', () => {
      expect(errorDeUrl('https://www.misiones .gob.ar')).toBe('urlEspacios');
    });

    it('sin un sitio después del esquema dice que está incompleta', () => {
      expect(errorDeUrl('https://')).toBe('urlIncompleta');
      expect(errorDeUrl('https://?consulta')).toBe('urlIncompleta');
    });
  });

  describe('localidad (alta)', () => {
    it('una localidad libre o sin elegir no tiene error', () => {
      expect(errorDeLocalidad('l-3', OCUPADAS)).toBeNull();
      expect(errorDeLocalidad('', OCUPADAS)).toBeNull();
    });

    it('distingue la que ya tiene una ficha activa de la que tiene una desactivada', () => {
      expect(errorDeLocalidad('l-1', OCUPADAS)).toBe('localidadOcupada');
      expect(errorDeLocalidad('l-2', OCUPADAS)).toBe('localidadDesactivada');
    });
  });

  describe('reactivar una ficha desactivada', () => {
    it('no se puede si la localidad ya tiene otra ficha activa de la adopción', () => {
      expect(reactivacionDuplicada({ activa: false, localidadId: 'l-1' }, OCUPADAS)).toBeTrue();
    });

    it('se puede si la otra ficha de la localidad también está desactivada, o si no hay otra', () => {
      expect(reactivacionDuplicada({ activa: false, localidadId: 'l-2' }, OCUPADAS)).toBeFalse();
      expect(reactivacionDuplicada({ activa: false, localidadId: 'l-3' }, OCUPADAS)).toBeFalse();
    });

    it('no aplica a una ficha que ya está activa ni a una sin localidad', () => {
      expect(reactivacionDuplicada({ activa: true, localidadId: 'l-1' }, OCUPADAS)).toBeFalse();
      expect(reactivacionDuplicada({ activa: false, localidadId: '' }, OCUPADAS)).toBeFalse();
    });
  });
});
