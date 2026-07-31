/** ViewModels de Geografía (BACKEND_API_SPEC.md §5.1). Datos maestros de referencia (sin ABM). */

/** Departamento. */
export interface DepartamentoVM {
  id: string; // UUID
  nombre: string;
}

/** Localidad, con su departamento resuelto (desnormalizado por el backend). */
export interface LocalidadVM {
  id: string; // UUID
  nombre: string;
  departamentoId: string;
  departamentoNombre: string;
}
