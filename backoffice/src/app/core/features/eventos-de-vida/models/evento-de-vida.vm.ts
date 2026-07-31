/** ViewModel de Evento de Vida (BACKEND_API_SPEC.md §5.3). */
export interface EventoDeVidaVM {
  id: string; // UUID
  slug: string;
  nombre: string;
}

/** Valor del formulario de evento de vida. El `slug` lo deriva el backend desde el `name`. */
export interface EventoDeVidaFormValue {
  nombre: string;
}
