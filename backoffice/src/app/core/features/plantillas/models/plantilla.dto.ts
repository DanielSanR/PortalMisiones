/**
 * Contrato real de `/api/procedure-template` (backend `origin/dev` @ `586b670`,
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
 * `slugBase` es único (si choca → 409 `4072`; era 400 antes de `586b670`), `titleBase` hasta 255
 * caracteres, `active` obligatorio. Desde `586b670` el backend canonicaliza el slug
 * (`ProcedureTemplateService.canonicalize`, misma regla que `canonicalizarSlug`) y devuelve el canónico
 * en `slugBase`: lo que se muestra tras guardar es SIEMPRE el del response. No valida que
 * `mainCategoryId` esté dentro de `categoryIds`.
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
