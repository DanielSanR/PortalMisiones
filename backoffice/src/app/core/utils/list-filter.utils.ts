import { FilterTabOption } from '../../shared/components/filter-tabs';

/**
 * Filtro client-side "Todos / Activos / Inactivos" reusado por las listas con campo `activo`
 * (organismos, tipos de organismo, usuarios — ver skill `screens-spec.md` §5). Filtra un stream
 * ya cargado (sin llamadas nuevas); ver patrón `BehaviorSubject<ActivoFiltro>` + `combineLatest`.
 */
export type ActivoFiltro = 'todos' | 'activos' | 'inactivos';

export function filterByActivo<T extends { activo: boolean }>(items: T[], filtro: ActivoFiltro): T[] {
  if (filtro === 'activos') return items.filter((item) => item.activo);
  if (filtro === 'inactivos') return items.filter((item) => !item.activo);
  return items;
}

export function activoFilterTabs<T extends { activo: boolean }>(items: T[]): FilterTabOption[] {
  return [
    { value: 'todos', label: 'Todos', count: items.length },
    { value: 'activos', label: 'Activos', count: items.filter((item) => item.activo).length },
    { value: 'inactivos', label: 'Inactivos', count: items.filter((item) => !item.activo).length },
  ];
}

/**
 * Chip único "Todas" + contador, para listas sin ningún campo real para filtrar (ver
 * `screens-spec.md` §11.9 y el encargo de la tarea: "no inventes filtros sin dato"). Mantiene
 * la barra de filter-tabs visualmente consistente con el resto de las listas sin fabricar datos.
 */
export function todasOnlyTabs(count: number): FilterTabOption[] {
  return [{ value: 'todas', label: 'Todas', count }];
}
