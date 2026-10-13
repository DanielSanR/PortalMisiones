import { RoleScopeType } from '@core/models/role.model';
import { PermisoVM } from '@features/permisos';

/** ViewModel de rol (con sus permisos resueltos). */
export interface RolVM {
  id: string;
  codigo: string; // sin prefijo ROLE_
  descripcion: string;
  scopeTipo: RoleScopeType; // 'global' | 'organismo'
  asignablePorOrgAdmin: boolean;
  /** ¿ADMIN_BACKOFFICE puede asignar este rol? */
  asignablePorBackoffice: boolean;
  activo: boolean;
  permisos: PermisoVM[];
}

/** Valor del formulario de rol. */
export interface RolFormValue {
  codigo: string;
  descripcion: string;
  scopeTipo: RoleScopeType;
  asignablePorOrgAdmin: boolean;
  asignablePorBackoffice: boolean;
  active: boolean;
  permissionsIds: string[];
}

/** Datos del formulario, resueltos en una sola llamada (permisos disponibles + rol en edición). */
export interface RolFormData {
  permisos: PermisoVM[];
  rol: RolVM | null;
}
