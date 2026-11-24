import { PermisoVM } from '@features/permisos';

/**
 * Agrupación de permisos atómicos por recurso — reusada por el panel de detalle de Roles
 * (`pages/roles/list`, read-friendly) y por el multi-select de badges del form de Rol
 * (`pages/roles/form`, interactivo). Único punto de verdad para no duplicar la lógica
 * de agrupación (DRY, ver `.claude/rules/scss-bem.md` + regla arquitectura-capas).
 */

/** Chip de permiso: otorgado (check, azul) o no otorgado (x, gris). */
export interface PermisoChipVM {
  id: string;
  label: string;
  /** Código del backend (`READ_USER`): no se muestra, sirve para buscar. */
  codigo: string;
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
  TAG: 'Etiquetas',
  ADOPTION: 'Trámites del organismo',
  ATTENTION_POINT: 'Puntos de atención',
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

/** Clave y etiqueta del grupo donde caen los códigos que no siguen `ACCION_RECURSO` con una acción conocida. */
const GRUPO_OTROS = { key: 'OTROS', label: 'Otros' };

interface EntradaDeChip {
  key: string;
  groupLabel: string;
  chip: PermisoChipVM;
}

/** Junta los chips por grupo (en orden de aparición) y ordena los grupos por etiqueta, en es. */
function agrupar(entradas: EntradaDeChip[]): PermisoGroupVM[] {
  const byResource = new Map<string, PermisoGroupVM>();
  for (const { key, groupLabel, chip } of entradas) {
    if (!byResource.has(key)) {
      byResource.set(key, { key, label: groupLabel, granted: 0, total: 0, items: [] });
    }
    const group = byResource.get(key)!;
    group.items.push(chip);
    group.total += 1;
    if (chip.granted) group.granted += 1;
  }
  return Array.from(byResource.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

/** Arma los grupos de permisos por recurso, comparando el catálogo completo contra los otorgados. */
export function buildPermisoGroups(catalog: PermisoVM[], grantedIds: Set<string>): PermisoGroupVM[] {
  return agrupar(
    catalog.map((permiso) => {
      const key = resourceOf(permiso.codigo);
      return {
        key,
        groupLabel: humanizeResource(key),
        chip: {
          id: permiso.id,
          label: actionLabel(permiso.codigo),
          codigo: permiso.codigo,
          granted: grantedIds.has(permiso.id),
        },
      };
    }),
  );
}

function esCodigoConocido(codigo: string): boolean {
  const [action, ...rest] = codigo.split('_');
  return rest.length > 0 && action in PERMISO_ACTION_LABELS;
}

/**
 * Agrupa los códigos que trae la sesión (`AuthUser.permissions`), sin catálogo: todos otorgados, el código hace de id.
 * Mismos grupos, etiquetas y orden que `buildPermisoGroups`; los códigos que no son `ACCION_RECURSO` con una acción
 * conocida van al final, en "Otros", con el código como etiqueta. Los repetidos cuentan una vez.
 */
export function gruposDeCodigos(codigos: readonly string[]): PermisoGroupVM[] {
  const unicos = Array.from(new Set(codigos));
  const conocidos = unicos.filter(esCodigoConocido);
  const otros = unicos.filter((codigo) => !esCodigoConocido(codigo));
  const grupos = buildPermisoGroups(
    conocidos.map((codigo) => ({ id: codigo, codigo, descripcion: '' })),
    new Set(conocidos),
  );
  if (!otros.length) return grupos;
  const [grupoOtros] = agrupar(
    otros.map((codigo) => ({
      key: GRUPO_OTROS.key,
      groupLabel: GRUPO_OTROS.label,
      chip: { id: codigo, label: codigo, codigo, granted: true },
    })),
  );
  return [...grupos, grupoOtros];
}
