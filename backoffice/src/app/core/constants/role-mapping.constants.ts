import { UserRole } from '../enums/user-role.enum';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles: UserRole[];
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    icon: 'dashboard',
    route: '/dashboard/home',
    roles: [UserRole.SUPERADMIN, UserRole.ADMIN_ORGANISMO, UserRole.EDITOR],
  },
  {
    label: 'Trámites',
    icon: 'description',
    route: '/dashboard/tramites/lista',
    roles: [UserRole.SUPERADMIN, UserRole.ADMIN_ORGANISMO, UserRole.EDITOR],
  },
  {
    label: 'Organismos',
    icon: 'business',
    route: '/dashboard/organismos/lista',
    roles: [UserRole.SUPERADMIN],
  },
  {
    label: 'Usuarios',
    icon: 'people',
    route: '/dashboard/usuarios/lista',
    roles: [UserRole.SUPERADMIN, UserRole.ADMIN_ORGANISMO],
  },
  {
    label: 'Reportes',
    icon: 'bar_chart',
    route: '/dashboard/reportes',
    roles: [UserRole.SUPERADMIN, UserRole.ADMIN_ORGANISMO],
  },
];
