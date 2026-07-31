/** DTOs del backend real de Destinatario/Recipient (BACKEND_API_SPEC.md §5.4). `/api/recipient`. */

export interface RecipientRequestDTO {
  name: string; // @NotBlank @Size 3-100 (único, case-insensitive)
}

export interface RecipientResponseDTO {
  id: string;
  name: string;
}
