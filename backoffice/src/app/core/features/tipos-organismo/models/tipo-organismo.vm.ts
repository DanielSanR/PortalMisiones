/** ViewModel de Tipo de Organismo (BACKEND_API_SPEC.md §5.2). */
export interface TipoOrganismoVM {
  id: string; // UUID
  code: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

/** Opción para selects (consumida cross-feature por el form de organismos). */
export interface TipoOrganismoOption {
  id: string;
  nombre: string;
}

/** Valor del formulario de tipo de organismo. */
export interface TipoOrganismoFormValue {
  nombre: string;
  descripcion: string;
  activo: boolean;
}
