/** ViewModel de Modalidad (BACKEND_API_SPEC.md §5.3). */
export interface ModalidadVM {
  id: string; // UUID
  nombre: string;
  activo: boolean;
}

/** Valor del formulario de modalidad (el backend solo persiste `name`). */
export interface ModalidadFormValue {
  nombre: string;
}
