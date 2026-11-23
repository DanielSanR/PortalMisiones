import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { environment } from '@env/environment';
import {
  AuthMeResponseDTO,
  AuthUser,
  ClientApp,
  JwtPayload,
  LoginRequest,
  RefreshTokenRequest,
} from '../models/auth.model';
import {
  JwtDTO,
  RefreshTokenResponseDTO,
  ResponseDTO,
  extractErrorCode,
} from '../models/api-response.model';
import { API_CODES } from '../constants/api-codes.constants';
import { AuthTokenService } from './auth-token.service';
import { parseAuthorities, pickHighestRole } from '../utils/role.utils';
import { AlcanceDeSesion, SIN_ALCANCE, alcanceDeSesion } from '../utils/session.utils';
import { UserRole } from '../enums/user-role.enum';
import { NoBackofficeAccessError } from '../errors/no-backoffice-access.error';
import { sinDialogoGlobal } from '../interceptors/http-error.interceptor';

/**
 * Qué se supo de `GET /api/auth/me` al abrir la sesión:
 * - `ok`: respondió; manda lo que diga.
 * - `sin-respuesta`: fallo PASAJERO (red, timeout, 5xx…): no dice nada sobre el alcance del usuario.
 * - `sin-organismo`: el backend contestó que el usuario ya no tiene un alcance válido (ver `esAlcancePerdido`).
 */
type ResultadoDeMe =
  | { tipo: 'ok'; me: AuthMeResponseDTO }
  | { tipo: 'sin-respuesta' }
  | { tipo: 'sin-organismo' };

/**
 * ¿`/me` falló porque el alcance del usuario dejó de existir? Son las dos respuestas DEFINITIVAS de
 * `AuthService.getCurrentAuthContext` (backend `586b670`): 403 `4029` si ya no tiene una asignación de rol
 * vigente (`UserService.getCurrentScope`) y 404 `4073` si el organismo de su alcance no existe. Se exigen el
 * status y el código juntos: un 403/404 de otro origen (proxy, WAF) no cuenta.
 */
function esAlcancePerdido(err: unknown): boolean {
  const { status, error } = (err ?? {}) as { status?: number; error?: unknown };
  const code = extractErrorCode(error);
  return (status === 403 && code === API_CODES.NO_PERMISSION)
    || (status === 404 && code === API_CODES.ENTITY_NOT_FOUND);
}

/** Payload de registro administrativo público (`UserRequestDTO`). */
export interface RegisterRequest {
  email: string;
  password: string;
  cuit?: string;
  avatar?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Backend real. Cada controller trae su prefijo; auth = /api/auth. */
  private readonly authUrl = `${environment.apiBaseUrl}/api/auth`;
  /** Esta app es el backoffice (resuelve URLs de activación/recuperación en el backend). */
  private readonly clientApp = ClientApp.BACKOFFICE;

  constructor(
    private http: HttpClient,
    private authTokenService: AuthTokenService
  ) {}

  /**
   * POST /api/auth/login → ResponseDTO<JwtDTO>. Guarda ambos tokens y la sesión.
   * Se salta el interceptor de errores global: el LoginComponent muestra el error inline.
   */
  login(email: string, password: string): Observable<AuthUser> {
    return this.http.post<ResponseDTO<JwtDTO>>(`${this.authUrl}/login`,{ email, password } as LoginRequest, sinDialogoGlobal()
    ).pipe(switchMap((res) => this.openSession(res.data)));
  }

  /** POST /api/auth/register (público). clientApp = BACKOFFICE. */
  register(payload: RegisterRequest): Observable<ResponseDTO<string>> {
    return this.http.post<ResponseDTO<string>>(`${this.authUrl}/register`, {
      ...payload,
      clientApp: this.clientApp,
    });
  }

  /**
   * POST /api/auth/activate-account → ResponseDTO<JwtDTO> (login automático).
   * La pantalla de activación muestra el error inline; se salta el diálogo global.
   */
  activateAccount(token: string): Observable<AuthUser> {
    return this.http
      .post<ResponseDTO<JwtDTO>>(
        `${this.authUrl}/activate-account`,
        { token },
        sinDialogoGlobal()
      )
      .pipe(switchMap((res) => this.openSession(res.data)));
  }

  /**
   * POST /api/auth/refresh → RefreshTokenResponseDTO (objeto PLANO, sin wrapper).
   * Rotación: invalida el refresh anterior y devuelve un nuevo par. Persistimos AMBOS.
   * Se salta el interceptor de errores para que el 401 lo maneje quien refresca.
   */
  refreshToken(refreshToken: string): Observable<RefreshTokenResponseDTO> {
    return this.http
      .post<RefreshTokenResponseDTO>(
        `${this.authUrl}/refresh`,
        { refreshToken } as RefreshTokenRequest,
        sinDialogoGlobal()
      )
      .pipe(
        switchMap((tokens) => this.openSession(tokens).pipe(map(() => tokens)))
      );
  }

  logout(): void {
    this.authTokenService.logout();
  }

  getAccessToken(): string | null {
    return this.authTokenService.getAccessToken();
  }

  getRefreshToken(): string | null {
    return this.authTokenService.getRefreshToken();
  }

  /**
   * Arma la sesión con los roles/permisos EFECTIVOS de `GET /api/auth/me` (fuente de verdad del
   * RBAC, BACKEND_API_SPEC §2). Si `/me` falla, cae al decode del JWT: un problema de ese endpoint
   * no puede dejar a nadie afuera del login. Lo que sí distingue es POR QUÉ falló (`ResultadoDeMe`),
   * porque de eso depende si se conserva el organismo que la sesión ya tenía (`alcance`). Un error de
   * sesión (token corrupto, sin acceso al backoffice) sí se propaga.
   */
  private openSession(tokens: JwtDTO | RefreshTokenResponseDTO): Observable<AuthUser> {
    return this.fetchMe(tokens.accessToken).pipe(
      map((me): ResultadoDeMe => ({ tipo: 'ok', me })),
      catchError((err: unknown) => of<ResultadoDeMe>({ tipo: esAlcancePerdido(err) ? 'sin-organismo' : 'sin-respuesta' })),
      map((resultado) => this.saveSession(tokens, resultado)),
    );
  }

  /**
   * GET /api/auth/me. Va bajo `/api/auth/`, que el authInterceptor deja sin Bearer (lo trata como
   * público), así que el token se adjunta acá. Tampoco dispara el diálogo global: el fallback es
   * silencioso.
   */
  private fetchMe(accessToken: string): Observable<AuthMeResponseDTO> {
    return this.http
      .get<ResponseDTO<AuthMeResponseDTO>>(`${this.authUrl}/me`, {
        headers: new HttpHeaders({ Authorization: `Bearer ${accessToken}` }),
        ...sinDialogoGlobal(),
      })
      .pipe(map((res) => res.data));
  }

  /**
   * Persiste el par de tokens y reconstruye la sesión. Roles y permisos salen de `/me` si llegó;
   * si no, del access token decodificado. El alcance y el organismo del usuario solo vienen en `/me`.
   * La autorización es POR PERMISO: un usuario sin rol canónico (solo rol custom) es una sesión
   * VÁLIDA — `role` queda `null` y el acceso se resuelve por sus permisos. Solo propaga error si
   * el token no se puede decodificar (token corrupto → el LoginComponent muestra el error inline).
   */
  private saveSession(tokens: JwtDTO | RefreshTokenResponseDTO, resultado: ResultadoDeMe): AuthUser {
    const me = resultado.tipo === 'ok' ? resultado.me : null;
    const payload = this.decodeToken(tokens.accessToken);
    // Separa roles y permisos (de `/me`, o del token: tolera el claim viejo mezclado y el nuevo).
    const { roles, roleCodes, permissions } = parseAuthorities(
      me ? { roles: me.roles, permissions: me.permissions } : payload,
    );

    // Gate de acceso al backoffice: entra CUALQUIER rol excepto el visitante del portal (`USER`).
    // Un usuario cuyo único rol es USER (rol por defecto del registro) queda afuera; cualquier otro
    // rol —canónico o custom, con o sin permisos— entra (el nav luego se arma por permiso).
    // El `|| permissions.length` es una red por si llegara un token con permisos y sin rol.
    const hasBackofficeAccess = roleCodes.some((c) => c !== UserRole.USER) || permissions.length > 0;
    if (!hasBackofficeAccess) throw new NoBackofficeAccessError();

    const user: AuthUser = {
      id: me?.userId ?? payload.userId,
      email: me?.email ?? payload.sub,
      nombre: payload.nombre ?? '',
      apellido: payload.apellido ?? '',
      role: pickHighestRole(roles), // rol canónico de mayor privilegio o null (custom-only)
      roles,
      roleCodes,
      permissions,
      ...this.alcance(resultado, payload),
    };

    this.authTokenService.setTokens(tokens.accessToken, tokens.refreshToken);
    this.authTokenService.setUserData(user);
    return user;
  }

  /**
   * Alcance y organismo de la sesión (`scope`, `organismId`, `organismName`, `organismAcronym` de `/me`,
   * backend `dev` @ `586b670`), según qué pasó con `/me`:
   *
   * - Respondió: manda lo que diga.
   * - Fallo pasajero (red, 5xx) y el token es del mismo usuario que ya estaba en sesión: se conserva lo que
   *   se sabía. Un endpoint caído no puede liberar el campo "Organismo" ni sacarle el organismo al perfil.
   * - El backend dijo que el alcance ya no existe (403 `4029` sin asignación vigente, 404 `4073` organismo
   *   inexistente): la sesión queda SIN organismo. Conservar el anterior dejaría a la persona operando
   *   sobre un organismo que ya no es el suyo, o que no existe. Tampoco se cae al claim del JWT.
   */
  private alcance(resultado: ResultadoDeMe, payload: JwtPayload): AlcanceDeSesion {
    if (resultado.tipo === 'ok') return alcanceDeSesion(resultado.me, payload.organismoId);
    if (resultado.tipo === 'sin-organismo') return SIN_ALCANCE;

    const previa = this.authTokenService.getCurrentUser();
    if (previa && previa.id === payload.userId && previa.scope) {
      return {
        scope: previa.scope,
        organismoId: previa.organismoId ?? null,
        organismoNombre: previa.organismoNombre ?? null,
        organismoSigla: previa.organismoSigla ?? null,
      };
    }
    return alcanceDeSesion(null, payload.organismoId);
  }

  private decodeToken(token: string): JwtPayload {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json) as JwtPayload;
  }
}
