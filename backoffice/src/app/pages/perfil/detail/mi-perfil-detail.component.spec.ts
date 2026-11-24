import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject } from 'rxjs';
import { UserRole } from '@core/enums/user-role.enum';
import { AuthUser } from '@core/models/auth.model';
import { CuentaFacade, SesionDeCuentaVM } from '@features/cuenta';
import { MiPerfilDetailComponent } from './mi-perfil-detail.component';

const AGENTE_IPS: AuthUser = {
  id: 'u-1',
  email: 'ana.paz@misiones.gob.ar',
  nombre: 'Ana',
  apellido: 'Paz',
  role: UserRole.AGENT,
  roles: [UserRole.AGENT],
  roleCodes: ['AGENT'],
  permissions: ['READ_VARIANT', 'UPDATE_VARIANT'],
  scope: 'organismo',
  organismoId: 'org-ips',
  organismoNombre: 'Instituto de Previsión Social',
  organismoSigla: 'IPS',
};

const ADMIN_GLOBAL: AuthUser = {
  id: 'u-2',
  email: 'juan.perez@misiones.gob.ar',
  nombre: '',
  apellido: '',
  role: UserRole.ADMIN_BACKOFFICE,
  roles: [UserRole.ADMIN_BACKOFFICE],
  roleCodes: ['ADMIN_BACKOFFICE'],
  permissions: ['READ_USER'],
  scope: 'global',
  organismoId: null,
  organismoNombre: null,
  organismoSigla: null,
};

describe('MiPerfilDetailComponent', () => {
  let fixture: ComponentFixture<MiPerfilDetailComponent>;
  let sesion$: BehaviorSubject<SesionDeCuentaVM>;

  async function montar(usuario: AuthUser, rol: string): Promise<void> {
    sesion$ = new BehaviorSubject<SesionDeCuentaVM>({ usuario, rol });
    await TestBed.configureTestingModule({
      imports: [MiPerfilDetailComponent],
      providers: [provideRouter([]), provideNoopAnimations(), { provide: CuentaFacade, useValue: { sesion$ } }],
    }).compileComponents();
    fixture = TestBed.createComponent(MiPerfilDetailComponent);
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const texto = (selector: string): string => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  /** Pares rótulo → valor del `<dl>` de "Datos de la cuenta". */
  const campos = (): Record<string, string> =>
    Object.fromEntries(
      Array.from(el().querySelectorAll('[data-testid="mi-perfil-datos"] .detail-field')).map((campo) => [
        campo.querySelector('dt')?.textContent?.trim() ?? '',
        campo.querySelector('dd')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ]),
    );

  it('muestra correo, rol y alcance; el organismo solo con sesión de organismo', async () => {
    await montar(AGENTE_IPS, 'Agente');

    expect(texto('.membrete__titulo')).toBe('Ana Paz');
    expect(texto('.detail-header__meta')).toContain('ana.paz@misiones.gob.ar');
    expect(texto('.detail-header__meta')).toContain('Instituto de Previsión Social (IPS)');
    const datos = campos();
    expect(Object.keys(datos)).toEqual(['Correo', 'Rol', 'Alcance', 'Organismo']);
    expect(datos['Correo']).toContain('ana.paz@misiones.gob.ar');
    expect(datos['Rol']).toBe('Agente');
    expect(datos['Alcance']).toContain('Por organismo');
    expect(datos['Alcance']).toContain('Ves y editás solo lo de tu organismo.');
    expect(datos['Organismo']).toBe('Instituto de Previsión Social (IPS)');

    TestBed.resetTestingModule();
    await montar(ADMIN_GLOBAL, 'Administrador de Backoffice');

    expect(Object.keys(campos())).toEqual(['Correo', 'Rol', 'Alcance']);
    expect(campos()['Alcance']).toContain('Global');
    expect(campos()['Alcance']).toContain('Ves y editás todo el backoffice.');
    expect(texto('.detail-header__meta')).toContain('Alcance global');
  });

  it('"Cambiar contraseña" está visible con appUnavailable, no disabled', async () => {
    await montar(AGENTE_IPS, 'Agente');

    const boton = Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Cambiar contraseña'));
    expect(boton).toBeDefined();
    expect(boton!.disabled).toBeFalse();
    expect(boton!.getAttribute('aria-disabled')).toBe('true');
  });

  it('agrupa los permisos de la sesión en chips de solo lectura, con el total', async () => {
    await montar(AGENTE_IPS, 'Agente');

    expect(texto('[data-testid="mi-perfil-permisos"] .ficha-paneles__total')).toBe('2 permisos');
    expect(texto('[data-testid="mi-perfil-permisos"] .ficha-paneles__subtitulo')).toBe('Viene de tu rol: Agente');
    const chips = Array.from(el().querySelectorAll('[data-testid="mi-perfil-permisos"] ul li.perm-chip')).map((chip) => chip.textContent?.trim());
    expect(chips).toEqual(['Leer', 'Editar']);
    expect(el().querySelector('[data-testid="mi-perfil-permisos"] button')).toBeNull();
  });

  it('con muchos permisos los grupos scrollean dentro del panel: región con techo, enfocable y con nombre', async () => {
    await montar(AGENTE_IPS, 'Agente');

    const region = el().querySelector<HTMLElement>('[data-testid="mi-perfil-grupos"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('tabindex')).toBe('0');
    expect(region?.getAttribute('role')).toBe('group');
    expect(region?.getAttribute('aria-label')).toBe('Permisos de tu rol: Agente');
    const estilo = getComputedStyle(region as HTMLElement);
    expect(estilo.overflowY).toBe('auto');
    expect(estilo.maxHeight).not.toBe('none');
  });

  it('sin permisos muestra "Tu rol no tiene permisos asignados"', async () => {
    await montar({ ...ADMIN_GLOBAL, permissions: [] }, 'Administrador de Backoffice');

    expect(texto('[data-testid="mi-perfil-permisos"]')).toContain('Tu rol no tiene permisos asignados');
    expect(texto('[data-testid="mi-perfil-permisos"] .ficha-paneles__total')).toBe('0 permisos');
  });

  it('sigue a la sesión: si cambia, la pantalla se actualiza', async () => {
    await montar(AGENTE_IPS, 'Agente');

    sesion$.next({ usuario: ADMIN_GLOBAL, rol: 'Administrador de Backoffice' });
    fixture.detectChanges();

    expect(texto('.membrete__titulo')).toBe('Juan Perez');
    expect(campos()['Rol']).toBe('Administrador de Backoffice');
  });
});
