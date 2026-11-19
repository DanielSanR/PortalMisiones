import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AuthMeResponseDTO, AuthUser } from '../models/auth.model';
import { UserRole } from '../enums/user-role.enum';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';

/** JWT de prueba (sin firma válida: el front solo decodifica el payload). */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown): string => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const EXP = Math.floor(Date.now() / 1000) + 3600;
const TOKEN_AO = jwt({ sub: 'ana@misiones.gob.ar', userId: 'u-ao', roles: ['ROLE_ADMIN_ORGANIZATION'], permissions: ['READ_TAG'], iat: 1, exp: EXP });
const TOKEN_SA = jwt({ sub: 'sa@misiones.gob.ar', userId: 'u-sa', roles: ['ROLE_SUPERADMIN'], permissions: ['READ_ORGANISM'], iat: 1, exp: EXP });

const ME_AO: AuthMeResponseDTO = {
  userId: 'u-ao', email: 'ana@misiones.gob.ar', roles: ['ROLE_ADMIN_ORGANIZATION'], permissions: ['READ_TAG', 'CREATE_TAG'],
  scope: 'organismo', organismId: 'org-uuid', organismName: 'Instituto de Previsión Social', organismAcronym: 'IPS',
};

/** `GET /api/auth/me` con el organismo de la sesión (backend `dev` @ `586b670`, pedido G-2). */
describe('AuthService — organismo de la sesión desde /api/auth/me', () => {
  let service: AuthService;
  let tokens: AuthTokenService;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    tokens = TestBed.inject(AuthTokenService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  /** Login completo: responde el login y después `/me` (con `me`, o con un 500 si es `null`). */
  async function login(accessToken: string, me: AuthMeResponseDTO | null): Promise<AuthUser> {
    const sesion = firstValueFrom(service.login('x@misiones.gob.ar', 'Clave1234'));
    backend.expectOne((r) => r.url.endsWith('/api/auth/login'))
      .flush({ code: 2000, message: '', data: { accessToken, refreshToken: 'refresh-1' } });
    const pedidoMe = backend.expectOne((r) => r.url.endsWith('/api/auth/me'));
    expect(pedidoMe.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    if (me) pedidoMe.flush({ code: 2013, message: '', data: me });
    else pedidoMe.flush({ code: 5000, message: 'boom' }, { status: 500, statusText: 'Error' });
    return sesion;
  }

  it('rol de organismo: la sesión guarda scope, id, nombre y sigla, y los expone el AuthTokenService', async () => {
    const user = await login(TOKEN_AO, ME_AO);

    expect(user).toEqual(jasmine.objectContaining({
      id: 'u-ao', role: UserRole.ADMIN_ORGANIZATION, scope: 'organismo',
      organismoId: 'org-uuid', organismoNombre: 'Instituto de Previsión Social', organismoSigla: 'IPS',
    }));
    expect(tokens.getCurrentUser()?.scope).toBe('organismo');
    expect(tokens.getUserOrganismoId()).toBe('org-uuid');
    expect(tokens.getUserOrganismo()).toEqual({ id: 'org-uuid', nombre: 'Instituto de Previsión Social', sigla: 'IPS' });
    // Sobrevive a una recarga: se persiste con el resto de la sesión.
    expect(JSON.parse(localStorage.getItem('user_data') ?? '{}').organismoId).toBe('org-uuid');
  });

  it('rol global: scope global y sin organismo', async () => {
    await login(TOKEN_SA, {
      userId: 'u-sa', email: 'sa@misiones.gob.ar', roles: ['ROLE_SUPERADMIN'], permissions: ['READ_ORGANISM'],
      scope: 'global', organismId: null, organismName: null, organismAcronym: null,
    });

    expect(tokens.getCurrentUser()?.scope).toBe('global');
    expect(tokens.getUserOrganismo()).toBeNull();
    expect(tokens.getUserOrganismoId()).toBeNull();
  });

  it('backend anterior (/me sin los campos nuevos): todo como antes, sin organismo ni scope', async () => {
    const user = await login(TOKEN_AO, { userId: 'u-ao', email: 'ana@misiones.gob.ar', roles: ['ROLE_ADMIN_ORGANIZATION'], permissions: ['READ_TAG'] });

    expect(user.scope).toBeNull();
    expect(user.organismoId).toBeNull();
    expect(tokens.getUserOrganismo()).toBeNull();
    expect(tokens.can('READ_TAG')).toBeTrue();
  });

  it('si /me falla, el login igual entra (decode del JWT) y no inventa un organismo', async () => {
    const user = await login(TOKEN_AO, null);

    expect(user.role).toBe(UserRole.ADMIN_ORGANIZATION);
    expect(user.scope).toBeNull();
    expect(tokens.getUserOrganismo()).toBeNull();
  });

  /** Refresh de la sesión ya abierta; `responderMe` decide qué contesta `GET /api/auth/me`. */
  async function refrescar(responderMe: (pedido: TestRequest) => void): Promise<void> {
    const refresco = firstValueFrom(service.refreshToken('refresh-1'));
    backend.expectOne((r) => r.url.endsWith('/api/auth/refresh')).flush({ accessToken: TOKEN_AO, refreshToken: 'refresh-2' });
    responderMe(backend.expectOne((r) => r.url.endsWith('/api/auth/me')));
    await refresco;
  }

  const ORGANISMO_AO = { id: 'org-uuid', nombre: 'Instituto de Previsión Social', sigla: 'IPS' };

  describe('refresh con /me fallando', () => {
    beforeEach(async () => { await login(TOKEN_AO, ME_AO); });

    const PASAJEROS: { caso: string; responder: (pedido: TestRequest) => void }[] = [
      { caso: '503 (endpoint caído)', responder: (p) => p.flush({}, { status: 503, statusText: 'Caído' }) },
      { caso: '500 con cuerpo de error', responder: (p) => p.flush({ code: 5000, message: 'boom' }, { status: 500, statusText: 'Error' }) },
      { caso: 'error de red', responder: (p) => p.error(new ProgressEvent('error')) },
      // Un 403/404 que no trae el código de negocio del backend (proxy, WAF) no dice nada del alcance.
      { caso: '403 sin el código 4029', responder: (p) => p.flush('Forbidden', { status: 403, statusText: 'Forbidden' }) },
      { caso: '404 sin el código 4073', responder: (p) => p.flush({ code: 4019, message: 'x' }, { status: 404, statusText: 'Not Found' }) },
    ];

    PASAJEROS.forEach(({ caso, responder }) => {
      it(`fallo pasajero — ${caso}: conserva el scope y el organismo que la sesión ya tenía`, async () => {
        await refrescar(responder);

        expect(tokens.getCurrentUser()?.scope).toBe('organismo');
        expect(tokens.getUserOrganismo()).toEqual(ORGANISMO_AO);
        expect(tokens.getRefreshToken()).toBe('refresh-2');
      });
    });

    it('403 código 4029 (el usuario ya no tiene una asignación vigente): la sesión queda SIN organismo', async () => {
      await refrescar((p) => p.flush(
        { code: 4029, message: 'El usuario no tiene permisos para realizar esta acción.', details: null },
        { status: 403, statusText: 'Forbidden' },
      ));

      expect(tokens.getUserOrganismo()).toBeNull();
      expect(tokens.getUserOrganismoId()).toBeNull();
      expect(tokens.getCurrentUser()).toEqual(jasmine.objectContaining({
        id: 'u-ao', scope: null, organismoId: null, organismoNombre: null, organismoSigla: null,
      }));
      // La sesión sigue abierta (con los permisos del token) y el par de tokens rotó igual.
      expect(tokens.isAuthenticated()).toBeTrue();
      expect(tokens.getRefreshToken()).toBe('refresh-2');
      expect(JSON.parse(localStorage.getItem('user_data') ?? '{}').organismoId).toBeNull();
    });

    it('404 código 4073 (el organismo del scope no existe): la sesión queda SIN organismo', async () => {
      await refrescar((p) => p.flush(
        { code: 4073, message: 'El objeto Organism con el identificador org-uuid no existe.', details: null },
        { status: 404, statusText: 'Not Found' },
      ));

      expect(tokens.getUserOrganismo()).toBeNull();
      expect(tokens.getCurrentUser()).toEqual(jasmine.objectContaining({
        id: 'u-ao', scope: null, organismoId: null, organismoNombre: null, organismoSigla: null,
      }));
      expect(tokens.isAuthenticated()).toBeTrue();
      expect(JSON.parse(localStorage.getItem('user_data') ?? '{}').organismoId).toBeNull();
    });

    it('después de perder el organismo, un fallo pasajero no lo resucita', async () => {
      await refrescar((p) => p.flush({ code: 4029, message: 'x' }, { status: 403, statusText: 'Forbidden' }));
      const otroRefresh = firstValueFrom(service.refreshToken('refresh-2'));
      backend.expectOne((r) => r.url.endsWith('/api/auth/refresh')).flush({ accessToken: TOKEN_AO, refreshToken: 'refresh-3' });
      backend.expectOne((r) => r.url.endsWith('/api/auth/me')).flush({}, { status: 503, statusText: 'Caído' });
      await otroRefresh;

      expect(tokens.getUserOrganismo()).toBeNull();
    });
  });

  it('login con /me en 403 4029: entra con el token y sin organismo, aunque el JWT trajera el claim', async () => {
    const tokenConClaim = jwt({
      sub: 'ana@misiones.gob.ar', userId: 'u-ao', roles: ['ROLE_ADMIN_ORGANIZATION'], permissions: ['READ_TAG'],
      organismoId: 'org-del-claim', iat: 1, exp: EXP,
    });
    const sesion = firstValueFrom(service.login('x@misiones.gob.ar', 'Clave1234'));
    backend.expectOne((r) => r.url.endsWith('/api/auth/login'))
      .flush({ code: 2000, message: '', data: { accessToken: tokenConClaim, refreshToken: 'refresh-1' } });
    backend.expectOne((r) => r.url.endsWith('/api/auth/me'))
      .flush({ code: 4029, message: 'x' }, { status: 403, statusText: 'Forbidden' });

    expect((await sesion).organismoId).toBeNull();
    expect(tokens.getUserOrganismo()).toBeNull();
  });

  it('…pero no se lo hereda otro usuario que entra después en el mismo navegador', async () => {
    await login(TOKEN_AO, ME_AO);
    const user = await login(TOKEN_SA, null);

    expect(user.id).toBe('u-sa');
    expect(tokens.getUserOrganismo()).toBeNull();
  });

  it('un refresh con /me arriba actualiza el organismo (cambió la asignación)', async () => {
    await login(TOKEN_AO, ME_AO);

    const refresco = firstValueFrom(service.refreshToken('refresh-1'));
    backend.expectOne((r) => r.url.endsWith('/api/auth/refresh')).flush({ accessToken: TOKEN_AO, refreshToken: 'refresh-2' });
    backend.expectOne((r) => r.url.endsWith('/api/auth/me'))
      .flush({ code: 2013, message: '', data: { ...ME_AO, organismId: 'org-otro', organismName: 'Rentas', organismAcronym: 'DGR' } });
    await refresco;

    expect(tokens.getUserOrganismo()).toEqual({ id: 'org-otro', nombre: 'Rentas', sigla: 'DGR' });
  });
});
