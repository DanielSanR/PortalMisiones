/** DTOs del backend real de Organismo (BACKEND_API_SPEC.md §5.2). `/api/organism`. SUPERADMIN. */

export interface OrganismRequestDTO {
  typeId: string; // @NotNull (UUID del tipo de organismo)
  parentId?: string | null;
  baseLocationId?: string | null;
  name: string; // @NotBlank
  acronym?: string | null;
  active?: boolean;
}

export interface OrganismResponseDTO {
  id: string;
  typeId: string;
  parentId: string | null;
  baseLocationId: string | null;
  name: string;
  acronym: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
