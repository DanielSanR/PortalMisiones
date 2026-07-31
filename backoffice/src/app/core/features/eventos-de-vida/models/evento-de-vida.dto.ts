/** DTOs del backend real de Evento de Vida (BACKEND_API_SPEC.md §5.3). `/api/life-event`. */

/** El backend deriva el `slug` desde el `name` (generateSlug); el request solo lleva `name`. */
export interface LifeEventRequestDTO {
  name: string; // @NotBlank @Size 3-100
}

export interface LifeEventResponseDTO {
  id: string;
  slug: string;
  name: string;
}
