import { Comando } from '@core/constants/comandos.constants';
import { NavItem } from '@core/constants/role-mapping.constants';
import { AuthzContext } from '@core/utils/authorization.utils';
import { buscarEnShell } from './buscador-comandos';

const SECCIONES: NavItem[] = [
  { label: 'Organismos', icon: 'buildings', route: '/dashboard/organismos' },
  { label: 'Usuarios', icon: 'users', route: '/dashboard/usuarios' },
];

const COMANDOS_DE_PRUEBA: Comando[] = [
  {
    label: 'Crear organismo',
    icon: 'buildings',
    keywords: ['nuevo', 'alta'],
    route: '/dashboard/organismos/nuevo',
    rule: { permissions: ['CREATE_ORGANISM'] },
  },
  { label: 'Cerrar sesión', icon: 'sign-out', keywords: ['salir'], id: 'cerrar-sesion' },
];

const SIN_PERMISOS: AuthzContext = { permissions: [], roles: [] };
const CON_ALTA: AuthzContext = { permissions: ['CREATE_ORGANISM'], roles: [] };

describe('buscarEnShell', () => {
  it('sin texto (o solo espacios) no hay búsqueda', () => {
    expect(buscarEnShell('   ', SECCIONES, CON_ALTA, COMANDOS_DE_PRUEBA)).toEqual({ resultados: [], grupos: [] });
  });

  it('agrupa secciones ("Ir a") y comandos ("Acciones") con índices corridos sobre la lista plana', () => {
    const { resultados, grupos } = buscarEnShell('ORGANISMO', SECCIONES, CON_ALTA, COMANDOS_DE_PRUEBA);

    expect(resultados.map((r) => r.label)).toEqual(['Organismos', 'Crear organismo']);
    expect(grupos.map((g) => g.titulo)).toEqual(['Ir a', 'Acciones']);
    expect(grupos.flatMap((g) => g.items.map((i) => i.indice))).toEqual([0, 1]);
  });

  it('no ofrece un comando que la regla de acceso no permite', () => {
    const { resultados, grupos } = buscarEnShell('organismo', SECCIONES, SIN_PERMISOS, COMANDOS_DE_PRUEBA);

    expect(resultados.map((r) => r.label)).toEqual(['Organismos']);
    expect(grupos.map((g) => g.titulo)).toEqual(['Ir a']);
  });

  it('un comando también se encuentra por sus sinónimos y conserva su `id`', () => {
    const { resultados } = buscarEnShell('salir', SECCIONES, SIN_PERMISOS, COMANDOS_DE_PRUEBA);

    expect(resultados).toEqual([
      { tipo: 'comando', label: 'Cerrar sesión', icon: 'sign-out', route: undefined, id: 'cerrar-sesion' },
    ]);
  });
});
