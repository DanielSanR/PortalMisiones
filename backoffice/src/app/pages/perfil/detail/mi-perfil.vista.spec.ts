import { AuthUser } from '@core/models/auth.model';
import { UserRole } from '@core/enums/user-role.enum';
import { vistaDePerfil } from './mi-perfil.vista';

const AGENTE_IPS: AuthUser = {
  id: 'u-1',
  email: 'ana.paz@misiones.gob.ar',
  nombre: 'Ana',
  apellido: 'Paz',
  role: UserRole.AGENT,
  roles: [UserRole.AGENT],
  roleCodes: ['AGENT'],
  permissions: ['READ_VARIANT', 'UPDATE_VARIANT', 'READ_ADOPTION'],
  scope: 'organismo',
  organismoId: 'org-ips',
  organismoNombre: 'Instituto de Previsión Social',
  organismoSigla: 'IPS',
};

/** Backend anterior a G-2: `/me` no manda `scope` ni organismo. */
const ADMIN_BACKEND_VIEJO: AuthUser = {
  id: 'u-2',
  email: 'juan.perez@misiones.gob.ar',
  nombre: '',
  apellido: '',
  role: UserRole.ADMIN_BACKOFFICE,
  roles: [UserRole.ADMIN_BACKOFFICE],
  roleCodes: ['ADMIN_BACKOFFICE'],
  permissions: ['READ_USER'],
};

describe('vistaDePerfil', () => {
  it('sesión de organismo: alcance "Por organismo", ayuda "Ves y editás solo lo de tu organismo." y organismo "Nombre (SIGLA)"', () => {
    const vista = vistaDePerfil(AGENTE_IPS, 'Agente');

    expect(vista.alcance).toBe('Por organismo');
    expect(vista.alcanceAyuda).toBe('Ves y editás solo lo de tu organismo.');
    expect(vista.organismo).toBe('Instituto de Previsión Social (IPS)');
    expect(vista.nombre).toBe('Ana Paz');
    expect(vista.iniciales).toBe('AP');
    expect(vista.email).toBe('ana.paz@misiones.gob.ar');
    expect(vista.rol).toBe('Agente');
    expect(vista.totalPermisos).toBe('3 permisos');
    expect(vista.grupos.map((grupo) => grupo.label)).toEqual(['Trámites del organismo', 'Variantes']);
  });

  it('sin scope ni organismo (backend viejo): alcance "Global" y organismo null', () => {
    const vista = vistaDePerfil(ADMIN_BACKEND_VIEJO, 'Administrador de Backoffice');

    expect(vista.alcance).toBe('Global');
    expect(vista.alcanceAyuda).toBe('Ves y editás lo de todos los organismos.');
    expect(vista.organismo).toBeNull();
    expect(vista.totalPermisos).toBe('1 permiso');
  });

  it('sin nombre en la sesión arma el nombre desde el correo', () => {
    const vista = vistaDePerfil(ADMIN_BACKEND_VIEJO, 'Administrador de Backoffice');

    expect(vista.nombre).toBe('Juan Perez');
    expect(vista.iniciales).toBe('JU');
  });

  it('sin permisos: grupos [] y totalPermisos "0 permisos"', () => {
    const vista = vistaDePerfil({ ...ADMIN_BACKEND_VIEJO, permissions: [] }, 'Administrador de Backoffice');

    expect(vista.grupos).toEqual([]);
    expect(vista.totalPermisos).toBe('0 permisos');
  });

  it('los códigos repetidos cuentan una vez en el total', () => {
    const vista = vistaDePerfil({ ...ADMIN_BACKEND_VIEJO, permissions: ['READ_USER', 'READ_USER'] }, 'Administrador de Backoffice');

    expect(vista.totalPermisos).toBe('1 permiso');
  });
});
