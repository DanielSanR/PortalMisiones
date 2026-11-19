import { EstadoPublicacion } from '@core/models/estado-publicacion.model';

/**
 * Contrato real de `/api/organism-procedure-location` ("OTL", ficha por localidad), backend
 * `origin/dev` @ `586b670`: `OrganismProcedureLocationRequestDTO` / `OrganismProcedureLocationResponseDTO`
 * y el enum `PublicationStatus`. Ver PLAN_TRAMITES_API.md §1.4. Los UUID viajan como string.
 */
export type PublicationStatus = EstadoPublicacion;

/**
 * Response de lista, detalle, alta, edición y transiciones (verbatim de `toResponse`). Trae todo lo que
 * el PUT necesita: el resultado de un `GET` sirve de base de un `PUT` sin perder contenido. No trae
 * nombres (trámite, organismo, localidad): los resuelve el facade con los otros catálogos.
 *
 * COMPATIBILIDAD TEMPORAL: un backend anterior a `586b670` responde solo `id`, `slug`, `publicationStatus`,
 * `active` y `currentVersionNumber`. Por eso el contenido figura como opcional: el mapper marca esas fichas
 * con `sinContenido` y la UI no deja editarlas (ver `FichaLocal.sinContenido`).
 *
 * No trae el `@Version` de la entidad ni el request lo lleva: el PUT no viaja con versión. El backend solo
 * detecta dos escrituras SIMULTÁNEAS (409 `4091`); un formulario abierto hace rato pisa lo que otro guardó
 * sin que el backend avise. `currentVersionNumber` es un contador de historial, no un candado: el facade lo
 * usa para releer justo antes del PUT y avisar si cambió (mitigación, no garantía).
 */
export interface OrganismProcedureLocationResponseDTO {
  id: string;
  /** Adopción ("trámite del organismo") de la que cuelga. Ausente en un backend anterior a `586b670`. */
  organismProcedureId?: string;
  /** Ausente en un backend anterior a `586b670`. */
  locationId?: string;
  slug: string;
  url?: string | null;
  requirements?: string | null;
  costs?: string | null;
  publicationStatus: PublicationStatus;
  active: boolean;
  /** Último `otl_versions.version_number` (0 si no hay versiones). */
  currentVersionNumber: number;
}

/**
 * POST/PUT (verbatim). `organismProcedureId`, `locationId`, `slug` y `active` son obligatorios
 * (`@NotNull`/`@NotBlank`): si falta alguno, 400 `4012`.
 * - `publicationStatus` se acepta por compatibilidad pero se IGNORA: el POST crea siempre en `BORRADOR`
 *   (versión 1) y el PUT conserva el estado vigente (solo cambia con los endpoints de workflow). El front
 *   no lo manda.
 * - PUT reemplaza todo el contenido (adopción, localidad, slug, url, requisitos, costos, activa).
 * - POST y PUT exigen que la adopción esté VIGENTE (`isEffectiveAt(now)`: habilitada, ya empezó y no
 *   venció): si no, 404 `4073` con la etiqueta `OrganismProcedure`, igual que si no existiera.
 * - UNIQUE (adopción, localidad) y (slug, adopción) (`V2.27`): el servicio no los valida antes de guardar,
 *   así que su violación llega como 500 `5000` (no como el 409 `4072` de los otros recursos).
 */
export interface OrganismProcedureLocationRequestDTO {
  organismProcedureId: string;
  locationId: string;
  slug: string;
  url: string | null;
  requirements: string | null;
  costs: string | null;
  active: boolean;
}

/** Filtros de `GET /api/organism-procedure-location` (se combinan con el alcance del usuario). */
export interface FichasLocalesFiltro {
  /** `?organismProcedureId=<uuid>`: solo las fichas de esa adopción (activas e inactivas). */
  adopcionId?: string;
}
