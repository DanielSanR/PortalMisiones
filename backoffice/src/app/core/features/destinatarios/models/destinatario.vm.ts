/** ViewModel de Destinatario/Recipient (BACKEND_API_SPEC.md §5.4). */
export interface DestinatarioVM {
  id: string; // UUID
  nombre: string;
}

/** Valor del formulario de destinatario. */
export interface DestinatarioFormValue {
  nombre: string;
}
