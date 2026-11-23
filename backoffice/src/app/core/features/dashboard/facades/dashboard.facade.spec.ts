import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { UserRole } from '@core/enums/user-role.enum';
import { AuthUser } from '@core/models/auth.model';
import { AuthTokenService } from '@core/services/auth-token.service';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { DashboardFacade } from './dashboard.facade';

/** El Home arma su matriz de widgets según el rol: lo expone el facade para que la pantalla no inyecte la sesión. */
describe('DashboardFacade — rolDeSesion$ (sesión)', () => {
  let usuario$: BehaviorSubject<AuthUser | null>;

  beforeEach(() => {
    usuario$ = new BehaviorSubject<AuthUser | null>(null);
    TestBed.configureTestingModule({
      providers: [
        { provide: DashboardRepository, useValue: jasmine.createSpyObj<DashboardRepository>('DashboardRepository', ['getHome']) },
        {
          provide: AuthTokenService,
          useValue: { getCurrentUser$: () => usuario$.asObservable(), getUserRole: () => usuario$.value?.role ?? null },
        },
      ],
    });
  });

  it('sin sesión: `null` (el Home no muestra ningún widget)', async () => {
    expect(await firstValueFrom(TestBed.inject(DashboardFacade).rolDeSesion$)).toBeNull();
  });

  it('con sesión: el rol canónico de quien mira', async () => {
    usuario$.next({ id: 'u-1', role: UserRole.AGENT } as AuthUser);

    expect(await firstValueFrom(TestBed.inject(DashboardFacade).rolDeSesion$)).toBe(UserRole.AGENT);
  });

  it('sigue a la sesión', () => {
    const vistos: (UserRole | null)[] = [];
    const sub = TestBed.inject(DashboardFacade).rolDeSesion$.subscribe((rol) => vistos.push(rol));

    usuario$.next({ id: 'u-1', role: UserRole.SUPERADMIN } as AuthUser);
    usuario$.next(null);
    sub.unsubscribe();

    expect(vistos).toEqual([null, UserRole.SUPERADMIN, null]);
  });

  it('no vuelve a emitir si la sesión se renueva con el mismo rol (refresco de token)', () => {
    usuario$.next({ id: 'u-1', role: UserRole.AGENT } as AuthUser);
    const vistos: (UserRole | null)[] = [];
    const sub = TestBed.inject(DashboardFacade).rolDeSesion$.subscribe((rol) => vistos.push(rol));

    usuario$.next({ id: 'u-1', role: UserRole.AGENT } as AuthUser);
    usuario$.next({ id: 'u-1', role: UserRole.AGENT } as AuthUser);
    usuario$.next({ id: 'u-1', role: UserRole.MANAGER } as AuthUser);
    sub.unsubscribe();

    expect(vistos).toEqual([UserRole.AGENT, UserRole.MANAGER]);
  });
});
