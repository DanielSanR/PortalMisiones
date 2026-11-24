import { PermisoVM } from '@features/permisos';
import { buildPermisoGroups, gruposDeCodigos } from './permiso-groups.util';

describe('gruposDeCodigos', () => {
  it('agrupa READ_USER y CREATE_USER en un solo grupo con dos chips', () => {
    const [g] = gruposDeCodigos(['READ_USER', 'CREATE_USER']);
    expect(g.total).toBe(2);
    expect(g.items.every((i) => i.granted)).toBeTrue();
    expect(g.granted).toBe(2);
    expect(g.label).toBe('Usuarios');
    expect(g.items.map((i) => i.label)).toEqual(['Leer', 'Crear']);
    expect(g.items.map((i) => i.id)).toEqual(['READ_USER', 'CREATE_USER']);
  });

  it('un código desconocido cae en un grupo "Otros" con el código como etiqueta', () => {
    const grupos = gruposDeCodigos(['READ_USER', 'ADMIN', 'FOO_BAR']);
    const otros = grupos.find((g) => g.label === 'Otros');
    expect(otros).toBeDefined();
    expect(otros!.items.map((i) => i.label)).toEqual(['ADMIN', 'FOO_BAR']);
    expect(otros!.items.every((i) => i.granted)).toBeTrue();
    expect(grupos[grupos.length - 1]).toBe(otros!);
  });

  it('sin códigos devuelve []', () => {
    expect(gruposDeCodigos([])).toEqual([]);
  });

  it('una "acción" que es una clave del prototipo (toString_X, constructor_X) no es conocida: va a "Otros" con el código', () => {
    const grupos = gruposDeCodigos(['toString_X', 'constructor_USER', 'READ_USER']);
    expect(grupos.map((g) => g.label)).toEqual(['Usuarios', 'Otros']);
    const otros = grupos[1];
    expect(otros.items.map((i) => i.label)).toEqual(['toString_X', 'constructor_USER']);
    expect(grupos.flatMap((g) => g.items).every((i) => typeof i.label === 'string')).toBeTrue();
  });

  it('descarta los códigos vacíos o en blanco antes de agrupar', () => {
    const grupos = gruposDeCodigos(['', '  ', 'READ_USER', '']);
    expect(grupos.length).toBe(1);
    expect(grupos[0].items.map((i) => i.codigo)).toEqual(['READ_USER']);
    expect(gruposDeCodigos(['', ' '])).toEqual([]);
  });

  it('ignora códigos repetidos', () => {
    const [g] = gruposDeCodigos(['READ_USER', 'READ_USER']);
    expect(g.total).toBe(1);
  });

  it('ordena los grupos igual que buildPermisoGroups', () => {
    const codigos = ['READ_USER', 'UPDATE_ROLE', 'CREATE_TAG', 'PUBLISH_VARIANT', 'READ_ORGANISM_TYPE'];
    const catalogo = codigos.map((codigo) => ({ id: codigo, codigo }) as PermisoVM);
    const desdeCatalogo = buildPermisoGroups(catalogo, new Set(codigos));
    expect(gruposDeCodigos(codigos)).toEqual(desdeCatalogo);
  });
});

describe('buildPermisoGroups', () => {
  it('con un código cuya acción o recurso es una clave del prototipo, las etiquetas siguen siendo texto', () => {
    const catalogo = [{ id: '1', codigo: 'toString_constructor' }] as PermisoVM[];
    const [g] = buildPermisoGroups(catalogo, new Set(['1']));
    expect(g.label).toBe('Constructor');
    expect(g.items[0].label).toBe('toString');
  });

  it('marca otorgados por id y cuenta por grupo', () => {
    const catalogo = [
      { id: '1', codigo: 'READ_USER' },
      { id: '2', codigo: 'DELETE_USER' },
      { id: '3', codigo: 'READ_ROLE' },
    ] as PermisoVM[];
    const grupos = buildPermisoGroups(catalogo, new Set(['1']));
    expect(grupos.map((g) => g.label)).toEqual(['Roles', 'Usuarios']);
    const usuarios = grupos[1];
    expect(usuarios.granted).toBe(1);
    expect(usuarios.total).toBe(2);
    expect(usuarios.items).toEqual([
      { id: '1', label: 'Leer', codigo: 'READ_USER', granted: true },
      { id: '2', label: 'Eliminar', codigo: 'DELETE_USER', granted: false },
    ]);
  });
});
