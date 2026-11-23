import { OrganismoVM } from '@features/organismos';
import {
  aValorDeOrganismo, camposConCatalogos, camposDeOrganismo, idsNoElegiblesComoPadre, nodosDelArbol, valorInicialDe,
} from './organismo-campos';

const org = (id: string, parentId: string | null, cambios: Partial<OrganismoVM> = {}): OrganismoVM => ({
  id, typeId: 't-1', parentId, baseLocationId: null, nombre: `Organismo ${id}`, acronym: id.toUpperCase(), activo: true, ...cambios,
});
/** a → b → c (cadena), d suelto e inactivo. */
const ORGANISMOS = [org('a', null), org('b', 'a'), org('c', 'b'), org('d', null, { activo: false })];
const TIPOS = new Map([['t-1', 'Ministerio']]);

describe('organismo-campos (formulario de organismo)', () => {
  describe('organismo superior', () => {
    it('no pueden ser padre el propio organismo ni su descendencia', () => {
      expect([...idsNoElegiblesComoPadre(ORGANISMOS, 'a')].sort()).toEqual(['a', 'b', 'c']);
      expect([...idsNoElegiblesComoPadre(ORGANISMOS, 'c')]).toEqual(['c']);
    });

    it('en el alta (sin id) no hay nada que excluir', () => {
      expect(idsNoElegiblesComoPadre(ORGANISMOS, '').size).toBe(0);
    });

    it('con un ciclo en los datos existentes termina igual', () => {
      const ciclo = [org('a', 'c'), org('b', 'a'), org('c', 'b')];
      expect([...idsNoElegiblesComoPadre(ciclo, 'a')].sort()).toEqual(['a', 'b', 'c']);
    });

    it('los no elegibles se muestran con su motivo; el propio organismo queda afuera (el árbol lo dibuja aparte)', () => {
      const nodos = nodosDelArbol(ORGANISMOS, TIPOS, 'a');

      expect(nodos.map((n) => [n.id, n.disabledReason])).toEqual([['b', 'Depende de este'], ['c', 'Depende de este'], ['d', 'Inactivo']]);
      expect(nodos[0]).toEqual(jasmine.objectContaining({ label: 'Organismo b', meta: 'Ministerio', parentId: 'a', keywords: 'B' }));
    });
  });

  it('carga los catálogos en la config sin tocar la original, con "Sin localidad" como primera opción', () => {
    const original = camposDeOrganismo();
    const config = camposConCatalogos(original, {
      tipos: [{ id: 't-1', nombre: 'Ministerio' }], localidades: [{ id: 'l-1', nombre: 'Posadas' }], organismos: ORGANISMOS, organismo: ORGANISMOS[1],
    }, 'b');
    const campo = (nombre: string) => config.fields!.find((f) => f.name === nombre)!;

    expect(campo('typeId').options).toEqual([jasmine.objectContaining({ id: 't-1', name: 'Ministerio' })]);
    expect(campo('baseLocationId').options!.map((o) => o.id)).toEqual(['', 'l-1']);
    expect(campo('parentId').tree!.self).toEqual({ id: 'b', label: 'Organismo b', tag: 'Este organismo' });
    expect(campo('parentId').tree!.nodes.map((n) => n.id)).toEqual(['a', 'c', 'd']);
    expect(original.fields!.find((f) => f.name === 'typeId')!.options).toEqual([]);
  });

  it('el formulario abre con "ninguno" como vacío y guarda "ninguno" como null', () => {
    expect(valorInicialDe(ORGANISMOS[0])).toEqual({
      nombre: 'Organismo a', acronym: 'A', typeId: 't-1', parentId: '', baseLocationId: '', activo: true,
    });
    expect(aValorDeOrganismo({ nombre: 'Salud', acronym: 'MSP', typeId: 't-1', parentId: '', baseLocationId: '', activo: false })).toEqual({
      typeId: 't-1', parentId: null, baseLocationId: null, nombre: 'Salud', acronym: 'MSP', activo: false,
    });
  });
});
