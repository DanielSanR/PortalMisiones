/** Opción de organismo para selects (consumida cross-feature por usuarios). */
export interface OrganismoOption {
  id: string;
  nombre: string;
}

/**
 * ViewModel de Organismo (BACKEND_API_SPEC.md §5.2).
 * `tipoNombre` y `parentNombre` los resuelve el facade: el DTO solo trae los ids.
 */
export interface OrganismoVM {
  id: string;
  typeId: string;
  tipoNombre?: string;
  parentId: string | null;
  parentNombre?: string;
  baseLocationId: string | null;
  nombre: string;
  acronym: string;
  activo: boolean;
  /** ISO del backend. Únicos datos temporales que expone hoy `/api/organism/{id}`. */
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** Organismo + las etiquetas de sus relaciones, resueltas contra los catálogos. */
export interface OrganismoDetalleVM {
  organismo: OrganismoVM;
  tipoNombre: string | null;
  parentNombre: string | null;
  localidadNombre: string | null;
}

/** Valor del formulario de organismo. `typeId` requerido; `parentId`/`baseLocationId` opcionales. */
export interface OrganismoFormValue {
  typeId: string;
  parentId: string | null;
  baseLocationId: string | null;
  nombre: string;
  acronym: string;
  activo: boolean;
}

/** Opción genérica para selects del form (id + etiqueta). */
export interface SelectOption {
  id: string;
  nombre: string;
}

/**
 * Datos del formulario de organismo, resueltos en una sola llamada (orquestación del facade).
 * `organismos` son VMs completos —no `OrganismoOption`— porque el form necesita `parentId`
 * para excluir la descendencia del organismo en edición y no permitir ciclos en el árbol.
 */
export interface OrganismoFormData {
  tipos: SelectOption[];
  localidades: SelectOption[];
  organismos: OrganismoVM[];
  organismo: OrganismoVM | null;
}
