/**
 * DTOs del backend real de Geografía (BACKEND_API_SPEC.md §5.1). Endpoints públicos.
 * Reemplazan al eliminado `Municipality`: modelo jerárquico Department (1) → Location (N).
 */

/** `GET /api/department` — DepartmentResponseDTO. */
export interface DepartmentResponseDTO {
  id: string;
  name: string;
}

/** `GET /api/location` — LocationResponseDTO (trae el departamento desnormalizado). */
export interface LocationResponseDTO {
  id: string;
  departmentId: string;
  departmentName: string;
  name: string;
}
