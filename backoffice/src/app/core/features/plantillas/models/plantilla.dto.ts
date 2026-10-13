/**
 * Contrato real de `/api/procedure-template` (backend `origin/dev` @ `23fd8f9`,
 * `ProcedureTemplateRequestDTO` / `ProcedureTemplateResponseDTO`). Ver PLAN_TRAMITES_API.md §1.2.
 *
 * El response trae SOLO ids (sin nombres ni fechas). Los UUID viajan como string.
 */
export interface ProcedureTemplateResponseDTO {
  id: string;
  slugBase: string;
  titleBase: string;
  shortDescription: string | null;
  longDescription: string | null;
  modalityId: string | null;
  mainCategoryId: string | null;
  categoryIds: string[];
  tagIds: string[];
  lifeEventIds: string[];
  recipientIds: string[];
  active: boolean;
}

/**
 * POST/PUT. El PUT es reemplazo total (incluidos los puentes): lo que no se manda se borra.
 * `slugBase` es único (si choca → 400 `4072`), `titleBase` hasta 255 caracteres, `active` obligatorio.
 * El backend NO canonicaliza el slug ni valida que `mainCategoryId` esté dentro de `categoryIds`.
 */
export interface ProcedureTemplateRequestDTO {
  slugBase: string;
  titleBase: string;
  shortDescription: string | null;
  longDescription: string | null;
  modalityId: string | null;
  mainCategoryId: string | null;
  categoryIds: string[];
  tagIds: string[];
  lifeEventIds: string[];
  recipientIds: string[];
  active: boolean;
}
