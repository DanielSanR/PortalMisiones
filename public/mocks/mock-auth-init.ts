import { UserRole } from '../enums/user-role.enum';

export function initMockAuth(): void {
  if (!localStorage.getItem('user_data')) {
    const mockUser = {
      id: 'usr-1',
      email: 'admin@misiones.gob.ar',
      nombre: 'Carlos',
      apellido: 'Fernández',
      role: UserRole.SUPERADMIN,
      organismoId: null,
    };
    localStorage.setItem('user_data', JSON.stringify(mockUser));
    localStorage.setItem('jwt_token', 'mock-jwt-token');
  }
}
