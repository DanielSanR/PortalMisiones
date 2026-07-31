/** DTOs del backend real de Tipo de Organismo (BACKEND_API_SPEC.md §5.2). `/api/organism-type`. */

export interface OrganismTypeRequestDTO {
  name: string; // @NotBlank
  description?: string | null;
  active?: boolean;
}

export interface OrganismTypeResponseDTO {
  id: string;
  code: string; // autogenerado desde name (no se envía)
  name: string;
  description: string | null;
  active: boolean;
}
