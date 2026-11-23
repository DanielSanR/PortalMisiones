import { COMANDOS, Comando } from '@core/constants/comandos.constants';
import { NavItem } from '@core/constants/role-mapping.constants';
import { AuthzContext, evaluateAccess } from '@core/utils/authorization.utils';

/** Una fila de resultados del buscador (navegación o comando). */
export interface ResultadoBuscador {
  tipo: 'nav' | 'comando';
  label: string;
  icon: string;
  route?: string;
  id?: Comando['id'];
}

/** Grupo del listado de resultados. `indice` es la posición en la lista plana
 *  `resultados`, para que las flechas recorran los grupos de corrido. */
export interface GrupoResultado {
  titulo: string;
  items: (ResultadoBuscador & { indice: number })[];
}

export interface ResultadosBusqueda {
  /** Resultados en lista plana: es el orden que recorren las flechas. */
  resultados: ResultadoBuscador[];
  /** Los mismos resultados agrupados, que es lo que dibuja el nav. */
  grupos: GrupoResultado[];
}

export const SIN_RESULTADOS: ResultadosBusqueda = { resultados: [], grupos: [] };

/**
 * Busca `query` entre las secciones que el usuario ve y los comandos que puede ejecutar (misma `AccessRule`
 * que la nav). Arma la lista plana (para las flechas) y su agrupación (para el nav) en una sola pasada, así
 * los índices no se pueden desfasar entre las dos vistas. Sin texto no hay búsqueda.
 */
export function buscarEnShell(
  query: string,
  secciones: readonly NavItem[],
  authz: AuthzContext,
  comandosDisponibles: readonly Comando[] = COMANDOS,
): ResultadosBusqueda {
  const q = query.trim().toLocaleLowerCase('es-AR');
  if (!q) return SIN_RESULTADOS;

  const navegacion: ResultadoBuscador[] = secciones
    .filter((item) => item.label.toLocaleLowerCase('es-AR').includes(q))
    .map((item) => ({ tipo: 'nav' as const, label: item.label, icon: item.icon, route: item.route }));

  const comandos: ResultadoBuscador[] = comandosDisponibles
    .filter((c) => evaluateAccess(authz, c.rule))
    .filter((c) => c.label.toLocaleLowerCase('es-AR').includes(q) || c.keywords.some((k) => k.includes(q)))
    .map((c) => ({ tipo: 'comando' as const, label: c.label, icon: c.icon, route: c.route, id: c.id }));

  return {
    resultados: [...navegacion, ...comandos],
    grupos: [
      { titulo: 'Ir a', items: navegacion.map((r, i) => ({ ...r, indice: i })) },
      { titulo: 'Acciones', items: comandos.map((r, i) => ({ ...r, indice: navegacion.length + i })) },
    ].filter((g) => g.items.length > 0),
  };
}
