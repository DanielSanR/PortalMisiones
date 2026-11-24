import { AuthUser } from '@core/models/auth.model';

/** La sesión en curso tal como la muestra "Mi perfil": el usuario y su rol legible. */
export interface SesionDeCuentaVM {
  usuario: AuthUser;
  /** Rol para mostrar (`AuthTokenService.getUserRoleLabel()`): "Administrador de Backoffice", "Sin rol asignado"… */
  rol: string;
}
