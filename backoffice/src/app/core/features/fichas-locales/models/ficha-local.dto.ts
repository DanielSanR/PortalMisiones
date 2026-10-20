import { EstadoPublicacion } from '@core/models/estado-publicacion.model';

/**
 * Contrato real de `/api/organism-procedure-location` ("OTL", ficha por localidad), backend
 * `origin/dev` @ `23fd8f9`: `OrganismProcedureLocationRequestDTO` / `OrganismProcedureLocationResponseDTO`
 * y el enum `PublicationStatus`. Ver PLAN_TRAMITES_API.md §1.4. Los UUID viajan como string.
 */
export type PublicationStatus = EstadoPublicacion;

/**
 * Response REAL de hoy (verbatim): `toResponse` solo mapea estos cinco campos. No trae de qué adopción
 * ni de qué localidad es la ficha, ni su URL, requisitos o costos (G-1, PEDIDOS_BACKEND.md).
 */
export interface OrganismProcedureLocationResponseDTO {
  id: string;
  slug: string;
  publicationStatus: PublicationStatus;
  active: boolean;
  /** Último `otl_versions.version_number` (0 si no hay versiones). */
  currentVersionNumber: number;
}

/**
 * Response EXTENDIDO que el front espera cuando el backend cierre G-1 (PEDIDOS_BACKEND.md, propuesta
 * concreta). Todos los campos agregados son opcionales: el mapper tolera tanto el response mínimo de
 * hoy como el completo, y lo que falte queda en `null` en el VM.
 * - Obligatorios en G-1: `organismProcedureId`, `locationId`, `url`, `requirements`, `costs`.
 * - Deseables: nombres desnormalizados (`procedureTitle`, `organismName`, `locationName`) y fechas.
 * El mock en memoria guarda esta forma con los obligatorios (como si G-1 estuviera resuelto).
 */
export interface OrganismProcedureLocationExtendedResponseDTO extends OrganismProcedureLocationResponseDTO {
  organismProcedureId?: string | null;
  locationId?: string | null;
  url?: string | null;
  requirements?: string | null;
  costs?: string | null;
  procedureTemplateId?: string | null;
  procedureTitle?: string | null;
  organismId?: string | null;
  organismName?: string | null;
  locationName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * POST/PUT (verbatim). El DTO no tiene validaciones: si falta un campo NOT NULL (`organismProcedureId`,
 * `locationId`, `slug`, `publicationStatus`, `active`) el backend responde 500 `5000`.
 * - POST ignora `publicationStatus` (siempre `BORRADOR`, versión 1).
 * - PUT es reemplazo TOTAL, incluido `publicationStatus` (R-1): el front manda SIEMPRE el estado
 *   actual de la ficha; el estado solo cambia con los endpoints de workflow.
 */
export interface OrganismProcedureLocationRequestDTO {
  organismProcedureId: string;
  locationId: string;
  slug: string;
  url: string | null;
  requirements: string | null;
  costs: string | null;
  publicationStatus: PublicationStatus;
  active: boolean;
}
