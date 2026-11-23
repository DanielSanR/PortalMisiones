import { PermisoVM } from '@features/permisos';
import { alternarGrupo, alternarPermiso, vistaDeGrilla } from './permisos-grilla.vista';

const PERMISOS: PermisoVM[] = [
  { id: 'p-1', codigo: 'READ_USER', descripcion: 'Ver usuarios' },
  { id: 'p-2', codigo: 'CREATE_USER', descripcion: 'Crear usuarios' },
  { id: 'p-3', codigo: 'READ_ROLE', descripcion: 'Ver roles' },
];

describe('vistaDeGrilla', () => {
  it('agrupa el catálogo por recurso y cuenta lo otorgado de cada grupo', () => {
    const vista = vistaDeGrilla(PERMISOS, ['p-1'], '');

    expect(vista.total).toBe(3);
    expect(vista.grupos.map((g) => [g.label, g.granted, g.total, g.etiquetaTodos])).toEqual([
      ['Roles', 0, 1, 'Marcar todos'], ['Usuarios', 1, 2, 'Marcar todos'],
    ]);
    expect(vista.sinCoincidencias).toBeFalse();
  });

  it('la búsqueda ignora mayúsculas y tildes, mira también el código, y el contador sigue contando todo', () => {
    const [usuarios] = vistaDeGrilla(PERMISOS, ['p-1'], ' CRÉATE_ ').grupos;

    expect(usuarios.items.map((i) => i.id)).toEqual(['p-2']);
    expect([usuarios.granted, usuarios.total]).toEqual([1, 2]);
    expect(usuarios.etiquetaTodos).toBe('Marcar el visible');
    expect(usuarios.ariaTodos).toBe('Marcar el permiso visible de Usuarios');
  });

  it('coincidir con el nombre del grupo muestra todos sus permisos', () => {
    const vista = vistaDeGrilla(PERMISOS, ['p-1', 'p-2'], 'usuarios');
    expect(vista.grupos.map((g) => [g.label, g.ids, g.etiquetaTodos])).toEqual([['Usuarios', ['p-1', 'p-2'], 'Quitar los 2 visibles']]);
  });

  it('sin coincidencias no deja grupos y lo marca; sin búsqueda nunca', () => {
    expect(vistaDeGrilla(PERMISOS, [], 'zzz')).toEqual({ total: 3, grupos: [], sinCoincidencias: true });
    expect(vistaDeGrilla([], [], '').sinCoincidencias).toBeFalse();
  });
});

describe('alternarPermiso / alternarGrupo', () => {
  it('otorgar suma al final y quitar saca solo ese', () => {
    expect(alternarPermiso(['p-3'], 'p-1')).toEqual(['p-3', 'p-1']);
    expect(alternarPermiso(['p-3', 'p-1'], 'p-3')).toEqual(['p-1']);
  });

  it('marcar un grupo suma los que faltan; quitarlo no toca los de otros grupos ni los ocultos', () => {
    expect(alternarGrupo(['p-3', 'p-1'], { todos: false, ids: ['p-1', 'p-2'] })).toEqual(['p-3', 'p-1', 'p-2']);
    expect(alternarGrupo(['p-3', 'p-1', 'p-2'], { todos: true, ids: ['p-2'] })).toEqual(['p-3', 'p-1']);
  });
});
