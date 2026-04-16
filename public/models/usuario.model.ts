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
