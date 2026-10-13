/** ViewModel de un punto de atención de una ficha por localidad (PLAN_TRAMITES_API.md §3/§4.4). */
export interface PuntoAtencionVM {
  id: string;
  /** `organismProcedureLocationId`: la ficha por localidad de la que cuelga. */
  fichaId: string;
  nombre: string;
  direccion: string;
  contacto: string | null;
  horarios: string | null;
  /** `null` solo en filas viejas sin coordenadas (la columna lo admite; el request las exige). */
  latitud: number | null;
  longitud: number | null;
  /** `false` = desactivado (`DELETE` lógico). El backend lo sigue listando. */
  activo: boolean;
}

/** Valor del formulario de alta/edición. El PUT es total: viajan todos los campos. */
export interface PuntoAtencionFormValue {
  fichaId: string;
  nombre: string;
  direccion: string;
  contacto: string;
  horarios: string;
  latitud: number;
  longitud: number;
  activo: boolean;
}
