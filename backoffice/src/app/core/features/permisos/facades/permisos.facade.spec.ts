import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ESCRIBIR_ROLES_PERMISOS_ACCESS } from '@core/constants/policy-overrides.constants';
import { AccessRule } from '@core/models/access-rule.model';
import { AuthUser } from '@core/models/auth.model';
import { AuthTokenService } from '@core/services/auth-token.service';
import { PermisosRepository } from '../repositories/permisos.repository';
import { PermisosFacade } from './permisos.facade';

/** `/api/permission` se autoriza por ROL: la pantalla le pregunta al facade si quien mira puede escribir. */
describe('PermisosFacade — puedeEscribir$ (sesión)', () => {
  let usuario$: BehaviorSubject<AuthUser | null>;
  let puede: boolean;
  let canAccess: jasmine.Spy<(rule: AccessRule) => boolean>;

  beforeEach(() => {
    usuario$ = new BehaviorSubject<AuthUser | null>(null);
    puede = false;
    canAccess = jasmine.createSpy('canAccess').and.callFake(() => puede);
    TestBed.configureTestingModule({
      providers: [
        { provide: PermisosRepository, useValue: jasmine.createSpyObj<PermisosRepository>('PermisosRepository', ['list']) },
        { provide: AuthTokenService, useValue: { getCurrentUser$: () => usuario$.asObservable(), canAccess } },
      ],
    });
  });

  it('evalúa la misma regla que la ruta de escritura (`ESCRIBIR_ROLES_PERMISOS_ACCESS`)', async () => {
    puede = true;

    expect(await firstValueFrom(TestBed.inject(PermisosFacade).puedeEscribir$)).toBeTrue();
    expect(canAccess).toHaveBeenCalledWith(ESCRIBIR_ROLES_PERMISOS_ACCESS);
  });

  it('sin sesión o con un rol que solo lee: `false`', async () => {
    expect(await firstValueFrom(TestBed.inject(PermisosFacade).puedeEscribir$)).toBeFalse();
  });

  it('sigue a la sesión: vuelve a evaluar la regla cuando cambia el usuario', () => {
    const vistos: boolean[] = [];
    const sub = TestBed.inject(PermisosFacade).puedeEscribir$.subscribe((valor) => vistos.push(valor));

    puede = true;
    usuario$.next({ id: 'u-1' } as AuthUser);
    puede = false;
    usuario$.next(null);
    sub.unsubscribe();

    expect(vistos).toEqual([false, true, false]);
  });

  it('no lee la sesión al construirse: recién al suscribirse', () => {
    TestBed.inject(PermisosFacade);

    expect(canAccess).not.toHaveBeenCalled();
  });
});
