/**
 * Contrato real de `/api/organism-procedure` (backend `origin/dev` @ `23fd8f9`,
 * `OrganismProcedureRequestDTO` / `OrganismProcedureResponseDTO`). Ver PLAN_TRAMITES_API.md §1.3.
 *
 * Los UUID viajan como string. Las fechas son `LocalDateTime` SIN zona: el backend las serializa con
 * Jackson (`JavaTimeModule`, sin timestamps) como ISO local — `2026-10-13T00:00` cuando los segundos
 * son 0, `2026-10-13T23:59:59` o con fracción si la hay — y las acepta como `yyyy-MM-ddTHH:mm:ss`.
 */
export interface OrganismProcedureResponseDTO {
  id: string;
  procedureTemplateId: string;
  organismId: string;
  ownerOrganismId: string | null;
  enabled: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

/**
 * POST/PUT. El PUT es reemplazo total: hay que reenviar plantilla, organismo y titular aunque no cambien.
 * - `procedureTemplateId` tiene que ser una plantilla ACTIVA y `organismId`/`ownerOrganismId` organismos
 *   ACTIVOS; si no → 404 `4073`. Con alcance de organismo, ambos tienen que ser el propio (si no, `4073`).
 * - `effectiveTo` (opcional) estrictamente posterior a `effectiveFrom` → si no, 400 `4012`.
 * - Con `enabled=true`, no puede solaparse con otra adopción habilitada de la misma plantilla en el
 *   mismo organismo → 409 `4080`.
 */
export interface OrganismProcedureRequestDTO {
  procedureTemplateId: string;
  organismId: string;
  ownerOrganismId: string | null;
  enabled: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}
