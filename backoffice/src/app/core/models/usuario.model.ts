import { UserRole } from '../enums/user-role.enum';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  organismoId: string | null;
  organismoNombre?: string;
  localidadId: number | null;
  localidadNombre?: string;
  activo: boolean;
  createdAt: string;
}

export interface UsuarioCreate {
  email: string;
  nombre: string;
  apellido: string;
  password: string;
  rol: UserRole;
  organismoId?: string;
  localidadId?: number;
}

export interface UsuarioUpdate {
  nombre?: string;
  apellido?: string;
  rol?: UserRole;
  organismoId?: string;
  localidadId?: number;
  activo?: boolean;
}

/**
 * Envelope paginado del mock legado (`/api/usuarios` del `mockApiInterceptor`). Lo usan solo
 * `UsuarioService` y el mock; el backend real responde `ResponseDTO<T>` (ver api-response.model).
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
