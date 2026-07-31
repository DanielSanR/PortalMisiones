/** DTOs del backend real de Modalidad (BACKEND_API_SPEC.md §5.3). `/api/modality`. */

export interface ModalityRequestDTO {
  name: string; // @NotBlank @Size 3-100
}

export interface ModalityResponseDTO {
  id: string;
  name: string;
  active: boolean; // soft-delete; los GET solo devuelven activas
}
