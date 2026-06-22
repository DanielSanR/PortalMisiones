/** ViewModel de etiqueta. Feature BLOQUEADA por backend (corre en mock; API spec §7). */
export interface EtiquetaVM {
  id: number;
  nombre: string;
  slug: string;
  icono: string;
  color: string;
  activo: boolean;
  tramitesCount: number;
}

/** Valor del formulario de etiqueta. */
export interface EtiquetaFormValue {
  nombre: string;
  icono: string;
  color: string;
}
