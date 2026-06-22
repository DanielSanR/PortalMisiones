import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { AuthUser } from '../models/auth.model';
import { UserRole, ROLE_TO_DISPLAY, ROLE_TO_SPANISH, UserRoleDisplay } from '../enums/user-role.enum';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_DATA_KEY = 'user_data';

@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  private currentUser = new BehaviorSubject<AuthUser | null>(null);

  constructor() {
    this.updateUserFromToken();
  }

  // ── Tokens ────────────────────────────────────────────────
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  /** Persiste el par de tokens (usado en login, activate-account y rotación de refresh). */
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);
  }

  setUserData(user: AuthUser): void {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
    this.currentUser.next(user);
  }

  // ── Estado de usuario ─────────────────────────────────────
  getCurrentUser(): AuthUser | null {
    return this.currentUser.getValue();
  }

  getCurrentUser$(): Observable<AuthUser | null> {
    return this.currentUser.asObservable();
  }

  isAuthenticated(): boolean {
    return this.currentUser.getValue() !== null;
  }

  isAuthenticated$(): Observable<boolean> {
    return this.currentUser.asObservable().pipe(map((user) => user !== null));
  }

  getUserRole(): UserRole | null {
    return this.currentUser.getValue()?.role ?? null;
  }

  /** Todos los roles del usuario (para RBAC multi-rol). */
  getUserRoles(): UserRole[] {
    return this.currentUser.getValue()?.roles ?? [];
  }

  /** ¿El usuario tiene alguno de los roles permitidos? */
  hasAnyRole(allowed: UserRole[]): boolean {
    const roles = this.getUserRoles();
    return allowed.some((r) => roles.includes(r));
  }

  /**
   * ¿El access token expiró (o está ausente/ilegible)? Decodifica el claim `exp`.
   * Tokens no-JWT (p. ej. el mock de dev) se consideran "expirados" → cubrir con bypass en dev.
   */
  isAccessTokenExpired(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64)) as { exp?: number };
      if (!payload.exp) return false;
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }

  /** Sesión válida = usuario presente y access token vigente. */
  hasValidSession(): boolean {
    return this.isAuthenticated() && !this.isAccessTokenExpired();
  }

  getUserRoleDisplay(): UserRoleDisplay | null {
    const role = this.getUserRole();
    return role ? ROLE_TO_DISPLAY[role] : null;
  }

  getUserRoleSpanish(): string | null {
    const role = this.getUserRole();
    return role ? ROLE_TO_SPANISH[role] : null;
  }

  getUserOrganismoId(): string | null {
    return this.currentUser.getValue()?.organismoId ?? null;
  }

  // ── Permisos (gating fino, derivado del claim `roles` del JWT) ─────────────
  getPermissions(): string[] {
    return this.currentUser.getValue()?.permissions ?? [];
  }

  hasPermission(permission: string): boolean {
    return this.getPermissions().includes(permission);
  }

  hasAnyPermission(...permissions: string[]): boolean {
    const owned = this.getPermissions();
    return permissions.some((p) => owned.includes(p));
  }

  hasAllPermissions(...permissions: string[]): boolean {
    const owned = this.getPermissions();
    return permissions.every((p) => owned.includes(p));
  }

  updateUserFromToken(): void {
    const userData = localStorage.getItem(USER_DATA_KEY);
    if (userData) {
      try {
        const user = JSON.parse(userData) as AuthUser;
        this.currentUser.next(user);
      } catch {
        this.clearUser();
      }
    }
  }

  clearUser(): void {
    this.currentUser.next(null);
  }

  logout(): void {
    this.clearTokens();
    this.clearUser();
  }
}
