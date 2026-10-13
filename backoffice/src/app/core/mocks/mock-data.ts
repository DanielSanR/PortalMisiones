import { PaginatedResponse, Usuario } from '../models/usuario.model';
import { UserRole } from '../enums/user-role.enum';

/**
 * Datos del mock legado (`mockApiInterceptor`). Tras la fase 5 de trámites solo queda `/api/usuarios`
 * (listado/edición de usuarios, que el backend real no expone). El resto de los catálogos viejos
 * (trámites, organismos, localidades, taxonomía, feedback) se retiró: cada feature tiene su mock propio.
 */

// ── Usuarios ────────────────────────────────────────────────
export const MOCK_USUARIOS: Usuario[] = [
  { id: 'usr-1', email: 'admin@misiones.gob.ar', nombre: 'Carlos', apellido: 'Fernández', rol: UserRole.SUPERADMIN, organismoId: null, organismoNombre: '-', localidadId: null, localidadNombre: undefined, activo: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'usr-2', email: 'ips.admin@misiones.gob.ar', nombre: 'María', apellido: 'González', rol: UserRole.ADMIN_ORGANIZATION, organismoId: 'org-1', organismoNombre: 'IPS', localidadId: null, localidadNombre: undefined, activo: true, createdAt: '2026-01-15T00:00:00Z' },
  { id: 'usr-3', email: 'registro.admin@misiones.gob.ar', nombre: 'Juan', apellido: 'Pérez', rol: UserRole.ADMIN_ORGANIZATION, organismoId: 'org-2', organismoNombre: 'Registro Provincial', localidadId: null, localidadNombre: undefined, activo: true, createdAt: '2026-01-20T00:00:00Z' },
  { id: 'usr-4', email: 'editor.rentas@misiones.gob.ar', nombre: 'Laura', apellido: 'Martínez', rol: UserRole.AGENT, organismoId: 'org-3', organismoNombre: 'DGR', localidadId: 1, localidadNombre: 'Posadas', activo: true, createdAt: '2026-02-01T00:00:00Z' },
  { id: 'usr-5', email: 'editor.edu@misiones.gob.ar', nombre: 'Roberto', apellido: 'Silva', rol: UserRole.AGENT, organismoId: 'org-4', organismoNombre: 'Min. Educación', localidadId: null, localidadNombre: undefined, activo: false, createdAt: '2026-02-15T00:00:00Z' },
];

// ── Helper: paginate ────────────────────────────────────────
export function paginate<T>(items: T[], page = 1, pageSize = 10): PaginatedResponse<T> {
  const start = (page - 1) * pageSize;
  const data = items.slice(start, start + pageSize);
  return {
    data,
    total: items.length,
    page,
    pageSize,
    totalPages: Math.ceil(items.length / pageSize),
  };
}
