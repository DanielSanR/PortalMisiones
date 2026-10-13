import { EstadoPublicacion } from '@core/models/estado-publicacion.model';

export type EstadoFicha = EstadoPublicacion;

/**
 * Ficha por localidad tal como la devuelve la fuente. Los campos que dependen de G-1 son `| null`:
 * con el response mínimo del backend de hoy llegan todos en `null` (`contenidoCompleto = false`).
 * Los nombres solo vienen si el backend los desnormaliza (G-1, deseable); si no, los resuelve el facade.
 */
export interface FichaLocal {
  id: string;
  slug: string;
  estado: EstadoFicha;
  /** `false` = desactivada (`DELETE` lógico). El backend la sigue listando. */
  activa: boolean;
  /** `currentVersionNumber`: cada alta, edición o transición genera una versión nueva. */
  version: number;
  adopcionId: string | null;
  localidadId: string | null;
  url: string | null;
  requisitos: string | null;
  costos: string | null;
  /**
   * `true` si la fuente devolvió adopción y localidad (G-1). Recién ahí se puede editar: con el
   * response mínimo, el PUT (reemplazo total) borraría requisitos, costos y URL.
   */
  contenidoCompleto: boolean;
  /** Desnormalizados por el backend (G-1 deseable); `null` si no vienen. */
  plantillaId: string | null;
  plantillaTitulo: string | null;
  organismoId: string | null;
  organismoNombre: string | null;
  localidadNombre: string | null;
}

/**
 * ViewModel de la ficha (PLAN_TRAMITES_API.md §3), con los nombres resueltos por el backend o por el
 * facade. Un nombre en `null` = no se pudo resolver (sin permiso de lectura, id que ya no está, o G-1).
 */
export type FichaLocalVM = FichaLocal;

/**
 * Valor del formulario. NO lleva estado: el PUT manda el estado actual de la ficha (lo resuelve el
 * facade releyéndola), nunca uno elegido por el usuario (mitiga R-1).
 */
export interface FichaLocalFormValue {
  adopcionId: string;
  localidadId: string;
  slug: string;
  url: string;
  requisitos: string;
  costos: string;
  activa: boolean;
}

/** Opción de localidad del form. */
export interface FichaLocalidadOpcion {
  id: string;
  nombre: string;
  departamentoNombre: string;
}

/** La adopción de la ficha, con lo que el form muestra y lo que usa para sugerir el slug (P-5). */
export interface FichaAdopcionResumen {
  id: string;
  plantillaTitulo: string | null;
  /** `slugBase` de la plantilla: base del slug sugerido. `null` si no se pudo leer. */
  plantillaSlug: string | null;
  organismoNombre: string | null;
  habilitada: boolean;
}

/** Lo que necesita el formulario de ficha, resuelto en una sola llamada por el facade. */
export interface FichaFormData {
  /** `null` en alta. */
  ficha: FichaLocalVM | null;
  /** `null` si no se pudo leer (sin `READ_ADOPTION`, o sin G-1 en edición). */
  adopcion: FichaAdopcionResumen | null;
  localidades: FichaLocalidadOpcion[];
  /**
   * Para validar duplicados en el cliente (mitiga G-9: el backend no tiene UNIQUE). Solo cuentan las
   * fichas ACTIVAS del alcance visible, sin la que se edita.
   */
  ocupadas: {
    /** Localidades que ya tienen una ficha activa de esta adopción. */
    localidadIds: string[];
    /** Slugs (canónicos) de las demás fichas activas. */
    slugs: string[];
  };
}
