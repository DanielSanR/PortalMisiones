/**
 * Catálogos contables del Home (P3 — "tira de configuración", HOME_REDISENO.md §3/§5). Cada clave
 * mapea 1:1 con el REPOSITORY del feature dueño del catálogo (`DashboardFacade` los consume vía
 * su barrel, nunca su facade — regla de capas).
 */
export type CatalogKey =
  | 'organismos'
  | 'tiposOrganismo'
  | 'categorias'
  | 'modalidades'
  | 'eventos'
  | 'destinatarios'
  | 'roles'
  | 'permisos';

/** Conteo por catálogo. Una clave ausente = no se pidió (sin permiso) o la fuente falló. */
export type CatalogCounts = Partial<Record<CatalogKey, number>>;
