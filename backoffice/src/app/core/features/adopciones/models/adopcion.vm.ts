import { EstadoVigencia } from './vigencia';

export type { EstadoVigencia } from './vigencia';

/**
 * Adopción tal como la devuelve la fuente (`OrganismProcedure`): solo ids, sin nombres y sin el
 * estado de vigencia (depende de la fecha actual). La consume el facade y, cross-feature, la fase 3
 * (fichas por localidad) vía `AdopcionesRepository`.
 */
export interface Adopcion {
  id: string;
  plantillaId: string;
  organismoId: string;
  /** `ownerOrganismId`: organismo titular, opcional. Se conserva tal cual al editar (el PUT es total). */
  organismoTitularId: string | null;
  /** `false` = deshabilitada: el listado del backend ya no la devuelve (sí `GET /{id}`). */
  habilitada: boolean;
  /** Inicio de la vigencia (hora local, sin zona). */
  vigenteDesde: Date;
  /** Fin de la vigencia (hora local, sin zona); `null` = sin fin. */
  vigenteHasta: Date | null;
}

/** ViewModel de la adopción ("Trámite del organismo"), con nombres y vigencia ya resueltos. */
export interface AdopcionVM extends Adopcion {
  /** Título de la plantilla; `null` si no se pudo resolver (sin `READ_PROCEDURE`, borrada o error). */
  plantillaTitulo: string | null;
  /** Nombre del organismo; `null` sin `READ_ORGANISM` o si no se pudo resolver. */
  organismoNombre: string | null;
  /** Lo calcula el facade con la fecha actual: `vigenteDesde <= ahora < vigenteHasta`. */
  vigente: boolean;
  estadoVigencia: EstadoVigencia;
}

/**
 * Valor del formulario (diálogo "Adoptar trámite" y edición en el detalle). Las fechas viajan tal cual
 * (`LocalDateTime`): el form decide los bordes del día — desde 00:00:00, hasta 23:59:59 inclusive — y
 * conserva las horas originales de lo que no se editó.
 */
export interface AdopcionFormValue {
  plantillaId: string;
  organismoId: string;
  organismoTitularId: string | null;
  habilitada: boolean;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
}

/** Opción de un select del diálogo. */
export interface AdopcionOpcion {
  id: string;
  nombre: string;
}

/** Lo que necesita el diálogo "Adoptar trámite": plantillas activas y organismos activos. */
export interface AdopcionOpciones {
  plantillas: AdopcionOpcion[];
  organismos: AdopcionOpcion[];
}
