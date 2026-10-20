import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { AuthUser } from '../models/auth.model';
import { UserRole } from '../enums/user-role.enum';
import { AuthzContext, canPerform, evaluateAccess, resolveRoleLabel } from '../utils/authorization.utils';
import { AccessRule } from '../models/access-rule.model';

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

  getUserOrganismoId(): string | null {
    return this.currentUser.getValue()?.organismoId ?? null;
  }

  // ── Permisos (gating fino, derivado del claim `roles` del JWT) ─────────────
  getPermissions(): string[] {
    return this.currentUser.getValue()?.permissions ?? [];
  }

  // ── Autorización (permiso + prerrequisitos de la UI) ───────────────────────────
  // Aplican los prerrequisitos (PERMISSION_PREREQUISITES) de forma consistente.
  // ⚠️ Son síncronos (leen el snapshot de sesión). NO cachear su resultado en un campo del
  // componente calculado UNA vez en ngOnInit: no reaccionaría a un cambio de sesión (refresh de
  // token con otros permisos, switcher de rol). Para gating reactivo, suscribirse a `getCurrentUser$()`
  // y recalcular con `can*` en cada emisión (así lo hacen `*appHasPermission` y el nav).
  private authzContext(): AuthzContext {
    return { permissions: this.getPermissions(), roles: this.getUserRoles() };
  }

  can(permission: string): boolean {
    return canPerform(this.authzContext(), permission);
  }

  canAny(...permissions: string[]): boolean {
    const ctx = this.authzContext();
    return permissions.some((p) => canPerform(ctx, p));
  }

  canAll(...permissions: string[]): boolean {
    const ctx = this.authzContext();
    return permissions.every((p) => canPerform(ctx, p));
  }

  /** Evalúa una `AccessRule` completa (permisos + roles), igual que el guard y el nav. */
  canAccess(rule: AccessRule): boolean {
    return evaluateAccess(this.authzContext(), rule);
  }

  /** Códigos de rol crudos (canónicos + custom) para display. */
  getRoleCodes(): string[] {
    return this.currentUser.getValue()?.roleCodes ?? [];
  }

  /** Etiqueta de rol para la UI: canónico traducido, custom prettified, o "Sin rol asignado". */
  getUserRoleLabel(): string {
    return resolveRoleLabel(this.getRoleCodes(), this.getUserRole());
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
