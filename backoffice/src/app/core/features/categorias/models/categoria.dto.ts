/** DTOs del backend real de Categoría (BACKEND_API_SPEC.md §5.3). `/api/category`. */

export interface CategoryRequestDTO {
  parentId?: string | null; // UUID; null/undefined = categoría raíz
  slug: string; // @NotBlank @Size 3-100 (único)
  name: string; // @NotBlank @Size 3-100
}

export interface CategoryResponseDTO {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
}
