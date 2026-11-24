import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { AuthUser } from '@core/models/auth.model';
import { PREFERENCIAS_DE_FABRICA, Preferencias } from '@core/models/preferencias.model';
import { AtajosService } from '@core/services/atajos.service';
import { AuthTokenService } from '@core/services/auth-token.service';
import { PreferenciasService } from '@core/services/preferencias.service';
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

/** "Preferencias" lee y escribe las preferencias locales por el facade (la pantalla no inyecta `core/services`). */
describe('CuentaFacade — preferencias locales', () => {
  let preferencias: jasmine.SpyObj<PreferenciasService>;
  let atajos: jasmine.SpyObj<AtajosService>;
  const PREFS: Preferencias = { ...PREFERENCIAS_DE_FABRICA, filasPorPagina: 20 };

  beforeEach(() => {
    preferencias = jasmine.createSpyObj<PreferenciasService>('PreferenciasService', ['actualizar', 'restablecer', 'olvidarCorreo'], {
      actual: PREFS,
      preferencias$: of(PREFS),
      esDeFabrica$: of(false),
      correoRecordado$: of('ana@misiones.gob.ar'),
    });
    atajos = jasmine.createSpyObj<AtajosService>('AtajosService', ['setHabilitados'], { habilitados$: of(false) });
    TestBed.configureTestingModule({
      providers: [
        { provide: CuentaRepository, useValue: jasmine.createSpyObj<CuentaRepository>('CuentaRepository', ['requestRecovery', 'changePassword']) },
        { provide: AuthTokenService, useValue: {} },
        { provide: PreferenciasService, useValue: preferencias },
        { provide: AtajosService, useValue: atajos },
      ],
    });
  });

  it('expone las preferencias, si son de fábrica, el correo recordado y los atajos', async () => {
    const facade = TestBed.inject(CuentaFacade);
    expect(await firstValueFrom(facade.preferencias$)).toEqual(PREFS);
    expect(await firstValueFrom(facade.preferenciasDeFabrica$)).toBeFalse();
    expect(await firstValueFrom(facade.correoRecordado$)).toBe('ana@misiones.gob.ar');
    expect(await firstValueFrom(facade.atajosHabilitados$)).toBeFalse();
  });

  it('filasPorPagina lee la preferencia actual (tamaño inicial de las listas paginadas en servidor)', () => {
    expect(TestBed.inject(CuentaFacade).filasPorPagina).toBe(20);
  });

  it('los comandos aplican al momento en los servicios de preferencias y atajos', () => {
    const facade = TestBed.inject(CuentaFacade);
    facade.actualizarPreferencias({ densidad: 'compacta' });
    facade.setAtajosHabilitados(false);
    facade.olvidarCorreo();
    facade.restablecerPreferencias();

    expect(preferencias.actualizar).toHaveBeenCalledOnceWith({ densidad: 'compacta' });
    expect(atajos.setHabilitados).toHaveBeenCalledOnceWith(false);
    expect(preferencias.olvidarCorreo).toHaveBeenCalledTimes(1);
    expect(preferencias.restablecer).toHaveBeenCalledTimes(1);
  });
});
