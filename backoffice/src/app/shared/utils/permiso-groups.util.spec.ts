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
