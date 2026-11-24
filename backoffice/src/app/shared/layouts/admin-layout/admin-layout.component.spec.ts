import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { AuthService } from '@core/services/auth.service';
import { PREFERENCIAS_STORAGE_KEY, PreferenciasService } from '@core/services/preferencias.service';
import { PREFERENCIAS_DE_FABRICA, Preferencias } from '@core/models/preferencias.model';
import { AuthUser } from '@core/models/auth.model';
import { AdminLayoutComponent } from './admin-layout.component';

describe('AdminLayoutComponent', () => {
  const guardarPreferencias = (cambios: Partial<Preferencias>): void =>
    localStorage.setItem(PREFERENCIAS_STORAGE_KEY, JSON.stringify({ ...PREFERENCIAS_DE_FABRICA, ...cambios }));

  /** Crea el layout en desktop o en mobile (Handset). */
  function crear(mobile = false): AdminLayoutComponent {
    const breakpoint: Pick<BreakpointObserver, 'observe'> = {
      observe: (): Observable<BreakpointState> => new BehaviorSubject<BreakpointState>({ matches: mobile, breakpoints: {} }),
    };
    const authToken: Pick<AuthTokenService, 'getCurrentUser$' | 'getCurrentUser' | 'getUserRoleLabel'> = {
      getCurrentUser$: () => new BehaviorSubject<AuthUser | null>(null),
      getCurrentUser: () => null,
      getUserRoleLabel: () => '',
    };
    TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: BreakpointObserver, useValue: breakpoint },
        { provide: AuthTokenService, useValue: authToken },
        { provide: AuthService, useValue: { logout: () => undefined } },
      ],
    });
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => localStorage.removeItem(PREFERENCIAS_STORAGE_KEY));
  afterEach(() => {
    localStorage.removeItem(PREFERENCIAS_STORAGE_KEY);
    document.documentElement.classList.remove('densidad-compacta');
  });

  it('con recordarMenuContraido y menuContraido arranca contraído en desktop', () => {
    guardarPreferencias({ recordarMenuContraido: true, menuContraido: true });
    expect(crear().isCollapsed).toBeTrue();
  });

  it('sin recordarMenuContraido arranca expandido aunque haya quedado menuContraido guardado', () => {
    guardarPreferencias({ recordarMenuContraido: false, menuContraido: true });
    expect(crear().isCollapsed).toBeFalse();
  });

  it('en mobile no aplica el menú contraído recordado', () => {
    guardarPreferencias({ recordarMenuContraido: true, menuContraido: true });
    expect(crear(true).isCollapsed).toBeFalse();
  });

  it('toggleCollapse guarda menuContraido siempre, aunque recordarMenuContraido esté apagado', () => {
    const layout = crear();
    const preferencias = TestBed.inject(PreferenciasService);

    layout.toggleCollapse();
    expect(preferencias.actual.menuContraido).toBeTrue();
    layout.toggleCollapse();
    expect(preferencias.actual.menuContraido).toBeFalse();

    preferencias.actualizar({ recordarMenuContraido: true });
    layout.toggleCollapse();
    expect(layout.isCollapsed).toBeTrue();
    expect(preferencias.actual.menuContraido).toBeTrue();
  });

  it('al abrir el shell aplica la densidad compacta guardada en <html>', () => {
    guardarPreferencias({ densidad: 'compacta' });
    crear();
    expect(document.documentElement.classList).toContain('densidad-compacta');
  });

  it('"Preferencias" del pie es un enlace a su pantalla, no una función pendiente', () => {
    crear();
    const enlace = Array.from(document.querySelectorAll<HTMLAnchorElement>('.admin-layout__footer-item')).find((el) =>
      el.textContent?.includes('Preferencias'),
    );
    expect(enlace?.tagName).toBe('A');
    expect(enlace?.getAttribute('href')).toBe('/dashboard/preferencias');
    expect(enlace?.getAttribute('aria-disabled')).toBeNull();
  });
});
