import { OrganismoVM } from '@features/organismos';
import { SIN_CATALOGOS, camposDeLectura, catalogosDe, datosDeMembrete, inicialesDe, membreteDesde } from './organismo-vista';

const SALUD: OrganismoVM = {
  id: 'o-1', typeId: 't-1', parentId: null, baseLocationId: null, nombre: 'Ministerio de Salud', acronym: 'MSP', activo: true,
};
const HOSPITAL: OrganismoVM = {
  id: 'o-2', typeId: 't-2', parentId: 'o-1', baseLocationId: 'l-1', nombre: ' Hospital Madariaga ', acronym: '', activo: false,
};
const CATALOGOS = catalogosDe({
  tipos: [{ id: 't-1', nombre: 'Ministerio' }, { id: 't-2', nombre: 'Hospital' }],
  organismos: [SALUD, HOSPITAL],
  localidades: [{ id: 'l-1', nombre: 'Posadas (Capital)' }],
});

describe('organismo-vista (membrete y tarjeta de lectura)', () => {
  describe('inicialesDe', () => {
    it('usa la sigla (hasta tres letras, sin signos) si tiene al menos dos', () => {
      expect(inicialesDe('m.s.p.', 'Ministerio de Salud Pública')).toBe('MSP');
      expect(inicialesDe('IPRODHA', 'Instituto')).toBe('IPR');
    });

    it('sin sigla toma las iniciales del nombre, salteando conectores', () => {
      expect(inicialesDe('', 'Ministerio de Salud Pública')).toBe('MS');
      expect(inicialesDe('', 'Vicegobernación')).toBe('VI');
    });

    it('sin nada escrito no inventa iniciales (se dibuja el ícono)', () => {
      expect(inicialesDe('', '')).toBe('');
      expect(inicialesDe('', ' de la ')).toBe('');
    });
  });

  describe('membreteDesde', () => {
    it('antes de cargar: sin nombre, activo y como organismo raíz', () => {
      expect(membreteDesde(null, SIN_CATALOGOS)).toEqual({
        nombre: '', iniciales: '', activo: true, datos: [{ texto: 'Organismo raíz', icono: 'tree-structure' }],
      });
    });

    it('arma la línea meta con tipo, dependencia y localidad resueltos por id', () => {
      expect(membreteDesde(HOSPITAL, CATALOGOS)).toEqual({
        nombre: 'Hospital Madariaga',
        iniciales: 'HM',
        activo: false,
        datos: [
          { texto: 'Hospital', icono: 'buildings' },
          { texto: 'Depende de Ministerio de Salud', icono: 'tree-structure' },
          { texto: 'Posadas (Capital)', icono: 'map-pin' },
        ],
      });
    });

    it('acompaña al formulario: "ninguno" (vacío) es raíz y sin localidad; activo salvo que se apague', () => {
      const datos = datosDeMembrete({ nombre: 'Salud', acronym: 'MSP', typeId: 't-1', parentId: '', baseLocationId: '' });

      expect(datos).toEqual({ nombre: 'Salud', acronym: 'MSP', typeId: 't-1', parentId: null, baseLocationId: null, activo: true });
      expect(datosDeMembrete({ activo: false }).activo).toBeFalse();
    });
  });

  describe('camposDeLectura', () => {
    it('muestra solo lo que el backend guarda, con los nombres de los catálogos', () => {
      expect(camposDeLectura(HOSPITAL, CATALOGOS)).toEqual([
        { label: 'Sigla', valor: null },
        { label: 'Tipo de organismo', valor: 'Hospital' },
        { label: 'Organismo superior', valor: 'Ministerio de Salud' },
        { label: 'Localidad base', valor: 'Posadas (Capital)' },
      ]);
    });

    it('un organismo raíz lo dice en vez de dejar el campo vacío', () => {
      expect(camposDeLectura(SALUD, CATALOGOS)[2]).toEqual({ label: 'Organismo superior', valor: 'Sin organismo superior' });
    });
  });
});
