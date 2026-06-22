import { UserRole } from '../enums/user-role.enum';
import { PERMISSIONS } from '../constants/permission.constants';

export function initMockAuth(): void {
  if (!localStorage.getItem('user_data')) {
    const mockUser = {
      id: 'usr-1',
      email: 'admin@misiones.gob.ar',
      nombre: 'Juan',
      apellido: 'Fernández',
      role: UserRole.SUPERADMIN,
      roles: [UserRole.SUPERADMIN],
      // Todos los permisos para poder probar gating fino sin backend.
      permissions: Object.values(PERMISSIONS),
      organismoId: null,
    };
    localStorage.setItem('user_data', JSON.stringify(mockUser));
    // Token de prueba para navegar sin backend (las rutas mock no validan el token).
    localStorage.setItem('access_token', 'mock-access-token');
    localStorage.setItem('refresh_token', 'mock-refresh-token');
  }
}
