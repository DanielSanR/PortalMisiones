import { PermisoVM } from '@features/permisos';

/**
 * Agrupación de permisos atómicos por recurso — reusada por el panel de detalle de Roles
 * (`pages/roles/list`, read-friendly) y por el multi-select de badges del form de Rol
 * (`pages/roles/create`, interactivo). Único punto de verdad para no duplicar la lógica
 * de agrupación (DRY, ver `.claude/rules/scss-bem.md` + regla arquitectura-capas).
 */

/** Chip de permiso: otorgado (check, azul) o no otorgado (x, gris). */
export interface PermisoChipVM {
  id: string;
  label: string;
  granted: boolean;
}

/** Grupo de permisos por recurso (ej. "Trámites", "Categorías") — ver BACKEND_API_SPEC.md §4.2. */
export interface PermisoGroupVM {
  key: string;
  label: string;
  granted: number;
  total: number;
  items: PermisoChipVM[];
}

// Los códigos de permiso siguen el formato `ACCION_RECURSO` (ver permission.constants.ts).
export const PERMISO_ACTION_LABELS: Record<string, string> = {
  CREATE: 'Crear',
  READ: 'Leer',
  UPDATE: 'Editar',
  DELETE: 'Eliminar',
  PUBLISH: 'Publicar',
  VIEW: 'Ver',
};

export const PERMISO_RESOURCE_LABELS: Record<string, string> = {
  ORGANISM: 'Organismos',
  ORGANISM_TYPE: 'Tipos de organismo',
  USER: 'Usuarios',
  ROLE: 'Roles',
  PROCEDURE: 'Trámites',
  VARIANT: 'Variantes',
  TAXONOMY: 'Taxonomía',
  CONTACT: 'Contactos',
  CATEGORY: 'Categorías',
  MODALITY: 'Modalidades',
  LIFE_EVENT: 'Eventos de vida',
  RECIPIENT: 'Destinatarios',
  STORAGE: 'Almacenamiento',
  ANALYTICS: 'Analítica',
};

function resourceOf(codigo: string): string {
  const [, ...rest] = codigo.split('_');
  return rest.length ? rest.join('_') : codigo;
}

function humanizeResource(resource: string): string {
  if (PERMISO_RESOURCE_LABELS[resource]) return PERMISO_RESOURCE_LABELS[resource];
  const words = resource.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function actionLabel(codigo: string): string {
  const action = codigo.split('_')[0];
  return PERMISO_ACTION_LABELS[action] ?? action;
}

/** Arma los grupos de permisos por recurso, comparando el catálogo completo contra los otorgados. */
export function buildPermisoGroups(catalog: PermisoVM[], grantedIds: Set<string>): PermisoGroupVM[] {
  const byResource = new Map<string, PermisoGroupVM>();
  for (const permiso of catalog) {
    const key = resourceOf(permiso.codigo);
    if (!byResource.has(key)) {
      byResource.set(key, { key, label: humanizeResource(key), granted: 0, total: 0, items: [] });
    }
    const group = byResource.get(key)!;
    const granted = grantedIds.has(permiso.id);
    group.items.push({ id: permiso.id, label: actionLabel(permiso.codigo), granted });
    group.total += 1;
    if (granted) group.granted += 1;
  }
  return Array.from(byResource.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'));
}
