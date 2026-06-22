/** ViewModel de permiso atómico (BACKEND_API_SPEC.md §4). */
export interface PermisoVM {
  id: string;
  codigo: string; // formato ACCION_RECURSO
  descripcion: string;
}

/** Valor del formulario de permiso. */
export interface PermisoFormValue {
  codigo: string;
  descripcion: string;
}
