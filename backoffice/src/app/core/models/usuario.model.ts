import { UserRole } from '../enums/user-role.enum';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  organismoId: string | null;
  organismoNombre?: string;
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
}

export interface UsuarioUpdate {
  nombre?: string;
  apellido?: string;
  rol?: UserRole;
  organismoId?: string;
  activo?: boolean;
}
