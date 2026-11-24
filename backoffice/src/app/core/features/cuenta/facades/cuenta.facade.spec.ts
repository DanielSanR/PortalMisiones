import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { AuthUser } from '@core/models/auth.model';
import { AuthTokenService } from '@core/services/auth-token.service';
import { CuentaRepository } from '../repositories/cuenta.repository';
import { SesionDeCuentaVM } from '../models/cuenta.vm';
import { CuentaFacade } from './cuenta.facade';

/** "Mi perfil" muestra la cuenta en curso: la expone el facade para que la pantalla no inyecte la sesión. */
describe('CuentaFacade — sesion$ (sesión)', () => {
  let usuario$: BehaviorSubject<AuthUser | null>;
  let rol: string;

  beforeEach(() => {
    usuario$ = new BehaviorSubject<AuthUser | null>(null);
    rol = 'Agente';
    TestBed.configureTestingModule({
      providers: [
        { provide: CuentaRepository, useValue: jasmine.createSpyObj<CuentaRepository>('CuentaRepository', ['requestRecovery', 'changePassword']) },
        { provide: AuthTokenService, useValue: { getCurrentUser$: () => usuario$.asObservable(), getUserRoleLabel: () => rol } },
      ],
    });
  });

  it('sin sesión no emite; con sesión, el usuario y su rol legible, y sigue a la sesión', () => {
    const vistos: SesionDeCuentaVM[] = [];
    const sub = TestBed.inject(CuentaFacade).sesion$.subscribe((sesion) => vistos.push(sesion));
    expect(vistos).toEqual([]);

    const ana = { id: 'u-1', email: 'ana@misiones.gob.ar' } as AuthUser;
    usuario$.next(ana);
    rol = 'Administrador de Organismo';
    const otra = { id: 'u-2', email: 'eva@misiones.gob.ar' } as AuthUser;
    usuario$.next(otra);
    sub.unsubscribe();

    expect(vistos).toEqual([
      { usuario: ana, rol: 'Agente' },
      { usuario: otra, rol: 'Administrador de Organismo' },
    ]);
  });
});
