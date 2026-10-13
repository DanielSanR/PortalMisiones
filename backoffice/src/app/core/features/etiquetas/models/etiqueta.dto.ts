/**
 * Contrato real de `/api/tag` (PPDT-5.8, backend `84fde37`). Ver BACKEND_API_SPEC.md §7.0.2.
 * Global ⇔ `organismId` null y `local=false`; local ⇔ con organismo y `local=true`.
 */
export interface TagResponseDTO {
  id: string;
  slug: string;
  local: boolean;
  organismId: string | null;
}

/** POST/PUT. El backend canonicaliza el slug y deriva `local` del organismo. */
export interface TagRequestDTO {
  slug: string;
  organismId: string | null;
}
