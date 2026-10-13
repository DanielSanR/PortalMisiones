import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
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
} from '../models/api-response.model';
import { AuthTokenService } from './auth-token.service';
import { parseAuthorities, pickHighestRole } from '../utils/role.utils';
import { UserRole } from '../enums/user-role.enum';
import { NoBackofficeAccessError } from '../errors/no-backoffice-access.error';
import { sinDialogoGlobal } from '../interceptors/http-error.interceptor';

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
   * no puede dejar a nadie afuera del login. Un error de sesión (token corrupto, sin acceso al
   * backoffice) sí se propaga.
   */
  private openSession(tokens: JwtDTO | RefreshTokenResponseDTO): Observable<AuthUser> {
    return this.fetchMe(tokens.accessToken).pipe(
      catchError(() => of(null)),
      map((me) => this.saveSession(tokens, me)),
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
   * si no, del access token decodificado.
   * La autorización es POR PERMISO: un usuario sin rol canónico (solo rol custom) es una sesión
   * VÁLIDA — `role` queda `null` y el acceso se resuelve por sus permisos. Solo propaga error si
   * el token no se puede decodificar (token corrupto → el LoginComponent muestra el error inline).
   */
  private saveSession(tokens: JwtDTO | RefreshTokenResponseDTO, me: AuthMeResponseDTO | null): AuthUser {
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
      organismoId: payload.organismoId ?? null,
    };

    this.authTokenService.setTokens(tokens.accessToken, tokens.refreshToken);
    this.authTokenService.setUserData(user);
    return user;
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
