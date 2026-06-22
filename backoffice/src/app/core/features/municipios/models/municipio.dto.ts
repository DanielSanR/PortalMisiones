/** Municipio del backend (`GET /api/municipality`, BACKEND_API_SPEC.md §5.1). Público. */
export interface MunicipalityResponseDTO {
  id: number;
  name: string;
  postalCode: string;
}
