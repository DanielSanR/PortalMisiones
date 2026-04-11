import { UserRole } from '../enums/user-role.enum';

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  role: UserRole;
  organismoId: string | null;
}

export interface AuthResponse {
  code: number;
  message: string;
  data: {
    token: string;
    refreshToken?: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface JwtPayload {
  sub: string;
  roles: string;
  userId: string;
  nombre: string;
  apellido: string;
  organismoId: string | null;
  exp: number;
  iat: number;
}
