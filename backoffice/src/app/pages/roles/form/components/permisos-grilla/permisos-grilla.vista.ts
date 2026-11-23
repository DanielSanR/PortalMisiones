import { PermisoVM } from '@features/permisos';
import { buildPermisoGroups, PermisoChipVM } from '@shared/utils/permiso-groups.util';

/** Un grupo de permisos tal como lo dibuja la grilla: chips ya filtrados por la búsqueda. */
export interface GrupoPermisosVista {
  key: string;
  label: string;
  granted: number;
  total: number;
  /** Todos los permisos visibles del grupo están otorgados: el botón pasa a "Quitar". */
  todos: boolean;
  /** Ids de los permisos visibles: lo que alterna "Marcar todos" (con búsqueda, solo los que coinciden). */
  ids: string[];
  /** Solo los que coinciden con la búsqueda, en el orden del catálogo. */
  items: PermisoChipVM[];
  /** Texto del botón del grupo ("Marcar todos", o "Marcar los 3 visibles" con búsqueda). */
  etiquetaTodos: string;
  /** `aria-label` del botón del grupo, con el nombre del grupo. */
  ariaTodos: string;
}

export interface VistaDeGrilla {
  /** Permisos del catálogo (lo que dice el buscador: "Buscar entre N permisos…"). */
  total: number;
  grupos: GrupoPermisosVista[];
  /** Hay búsqueda y ningún permiso coincide. */
  sinCoincidencias: boolean;
}

/** Textos del botón "Marcar/Quitar" de un grupo: con búsqueda activa dicen que actúan solo sobre los visibles. */
function etiquetasDeGrupo(todos: boolean, filtrado: boolean, visibles: number, grupo: string):
  Pick<GrupoPermisosVista, 'etiquetaTodos' | 'ariaTodos'> {
  const accion = todos ? 'Quitar' : 'Marcar';
  if (!filtrado) {
    return { etiquetaTodos: `${accion} todos`, ariaTodos: `${accion} todos los permisos de ${grupo}` };
  }
  return visibles === 1
    ? { etiquetaTodos: `${accion} el visible`, ariaTodos: `${accion} el permiso visible de ${grupo}` }
    : {
      etiquetaTodos: `${accion} los ${visibles} visibles`,
      ariaTodos: `${accion} los ${visibles} permisos visibles de ${grupo}`,
    };
}

/** Minúsculas y sin tildes, para que "publicacion" encuentre "Publicación". */
function paraBuscar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** El catálogo agrupado por recurso, con lo otorgado marcado y filtrado por la búsqueda. */
export function vistaDeGrilla(permisos: PermisoVM[], otorgados: readonly string[], busqueda: string): VistaDeGrilla {
  const buscado = paraBuscar(busqueda);
  const grupos = buildPermisoGroups(permisos, new Set(otorgados))
    .map((g): GrupoPermisosVista => {
      // Si coincide el nombre del grupo, se muestran todos sus permisos.
      const items = !buscado || paraBuscar(g.label).includes(buscado)
        ? g.items
        // También por código (`READ_USER`, o "user"): es como figura el permiso en el backend y en los logs.
        : g.items.filter((i) => paraBuscar(i.label).includes(buscado) || paraBuscar(i.codigo).includes(buscado));
      const todos = items.length > 0 && items.every((i) => i.granted);
      return {
        key: g.key,
        label: g.label,
        granted: g.granted,
        total: g.total,
        todos,
        ids: items.map((i) => i.id),
        items,
        ...etiquetasDeGrupo(todos, !!buscado, items.length, g.label),
      };
    })
    .filter((g) => g.items.length > 0);

  return { total: permisos.length, grupos, sinCoincidencias: !!buscado && grupos.length === 0 };
}

/** Otorga o quita un permiso (el orden de los chips no cambia: sale del catálogo). */
export function alternarPermiso(otorgados: readonly string[], permisoId: string): string[] {
  return otorgados.includes(permisoId) ? otorgados.filter((id) => id !== permisoId) : [...otorgados, permisoId];
}

/** "Marcar todos" / "Quitar todos" del grupo; con búsqueda activa, solo los permisos visibles. */
export function alternarGrupo(otorgados: readonly string[], grupo: Pick<GrupoPermisosVista, 'todos' | 'ids'>): string[] {
  return grupo.todos
    ? otorgados.filter((id) => !grupo.ids.includes(id))
    : [...otorgados, ...grupo.ids.filter((id) => !otorgados.includes(id))];
}
